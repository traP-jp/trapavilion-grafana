package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gopkg.in/yaml.v3"
)

// Event はタイムテーブルのイベントを表す
type Event struct {
	ID       string `yaml:"id"`
	Name     string `yaml:"name"`
	Location string `yaml:"location"`
	Start    string `yaml:"start"` // RFC3339 文字列
	End      string `yaml:"end"`   // RFC3339 文字列
	// 内部でパースした値は runtime 時に扱う
	startTime time.Time
	endTime   time.Time
}

// EventList は YAML のトップレベル構造
type EventList struct {
	Events []Event `yaml:"events"`
}

// EventCollector は Prometheus の Collector を実装する
type EventCollector struct {
	eventsPath string
	mtx        sync.RWMutex
	events     []Event

	// descriptors
	descStart    *prometheus.Desc
	descEnd      *prometheus.Desc
	descDuration *prometheus.Desc
	descActive   *prometheus.Desc
}

// NewEventCollector を作る
func NewEventCollector(eventsPath string) *EventCollector {
	labels := []string{"id", "name", "location"}
	return &EventCollector{
		eventsPath: eventsPath,
		descStart: prometheus.NewDesc(
			"time_table_event_start_seconds",
			"Event start time as Unix seconds",
			labels, nil,
		),
		descEnd: prometheus.NewDesc(
			"time_table_event_end_seconds",
			"Event end time as Unix seconds",
			labels, nil,
		),
		descDuration: prometheus.NewDesc(
			"time_table_event_duration_seconds",
			"Event duration in seconds",
			labels, nil,
		),
		descActive: prometheus.NewDesc(
			"time_table_event_active",
			"1 if event is active at scrape time, 0 otherwise",
			labels, nil,
		),
	}
}

// Describe implements prometheus.Collector
func (c *EventCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.descStart
	ch <- c.descEnd
	ch <- c.descDuration
	ch <- c.descActive
}

// Collect implements prometheus.Collector
func (c *EventCollector) Collect(ch chan<- prometheus.Metric) {
	c.mtx.RLock()
	events := make([]Event, len(c.events))
	copy(events, c.events)
	c.mtx.RUnlock()

	now := time.Now().UTC()
	for _, e := range events {
		labels := []string{e.ID, e.Name, e.Location}

		// start
		if !e.startTime.IsZero() {
			ch <- prometheus.MustNewConstMetric(c.descStart, prometheus.GaugeValue, float64(e.startTime.Unix()), labels...)
		}
		// end
		if !e.endTime.IsZero() {
			ch <- prometheus.MustNewConstMetric(c.descEnd, prometheus.GaugeValue, float64(e.endTime.Unix()), labels...)
		}
		// duration
		if !e.startTime.IsZero() && !e.endTime.IsZero() {
			dur := e.endTime.Sub(e.startTime).Seconds()
			if dur < 0 {
				dur = 0
			}
			ch <- prometheus.MustNewConstMetric(c.descDuration, prometheus.GaugeValue, dur, labels...)
		}
		// active
		active := 0.0
		if !e.startTime.IsZero() && !e.endTime.IsZero() && (now.Equal(e.startTime) || now.Equal(e.endTime) || (now.After(e.startTime) && now.Before(e.endTime))) {
			active = 1.0
		}
		ch <- prometheus.MustNewConstMetric(c.descActive, prometheus.GaugeValue, active, labels...)
	}
}

// loadEventsFromFile は YAML を読み込み Event スライスを返す
func loadEventsFromFile(path string) ([]Event, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	var el EventList
	if err := yaml.Unmarshal(b, &el); err != nil {
		return nil, err
	}
	// parse times
	for i := range el.Events {
		s := el.Events[i].Start
		e := el.Events[i].End
		if s == "" || e == "" {
			return nil, errors.New("start and end must be provided in RFC3339 format for each event")
		}
		tStart, err := time.Parse(time.RFC3339, s)
		if err != nil {
			return nil, fmt.Errorf("parse start time for id=%s: %w", el.Events[i].ID, err)
		}
		tEnd, err := time.Parse(time.RFC3339, e)
		if err != nil {
			return nil, fmt.Errorf("parse end time for id=%s: %w", el.Events[i].ID, err)
		}
		// convert to UTC for internal use
		el.Events[i].startTime = tStart.UTC()
		el.Events[i].endTime = tEnd.UTC()
	}
	return el.Events, nil
}

// watchLoop はポーリングでファイルを監視し更新があればロードする（簡易実装）
func (c *EventCollector) watchLoop(interval time.Duration, stop <-chan struct{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var lastMod time.Time
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			info, err := os.Stat(c.eventsPath)
			if err != nil {
				// ファイルがない・読み取りエラー -> ログに出すが継続
				log.Printf("stat events file: %v", err)
				continue
			}
			mod := info.ModTime()
			if mod.After(lastMod) {
				events, err := loadEventsFromFile(c.eventsPath)
				if err != nil {
					log.Printf("failed to load events: %v", err)
					lastMod = mod // avoid tight loop on parse error; still update lastMod to not retry immediately
					continue
				}
				c.mtx.Lock()
				c.events = events
				c.mtx.Unlock()
				lastMod = mod
				log.Printf("loaded %d events from %s", len(events), c.eventsPath)
			}
		}
	}
}

func main() {
	var (
		listen        = flag.String("listen", ":9100", "listen address for metrics and health")
		eventsPath    = flag.String("events", "events.yaml", "path to events YAML")
		reloadSeconds = flag.Int("reload-interval", 10, "polling interval in seconds for events file reload")
	)
	flag.Parse()

	collector := NewEventCollector(*eventsPath)
	prometheus.MustRegister(collector)

	// initial load (log but continue even if not present)
	if evs, err := loadEventsFromFile(*eventsPath); err == nil {
		collector.mtx.Lock()
		collector.events = evs
		collector.mtx.Unlock()
		log.Printf("initially loaded %d events", len(evs))
	} else {
		log.Printf("initial load failed: %v", err)
	}

	stop := make(chan struct{})
	go collector.watchLoop(time.Duration(*reloadSeconds)*time.Second, stop)

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("starting exporter on %s, watching %s (reload interval=%ds)", *listen, *eventsPath, *reloadSeconds)
	if err := http.ListenAndServe(*listen, nil); err != nil {
		close(stop)
		log.Fatalf("server stopped: %v", err)
	}
}
