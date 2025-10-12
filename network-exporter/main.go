package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type transferLatency struct {
	IQM    float64 `json:"iqm"`
	Low    float64 `json:"low"`
	High   float64 `json:"high"`
	Jitter float64 `json:"jitter"`
}

type transferResult struct {
	Bandwidth float64         `json:"bandwidth"`
	Bytes     float64         `json:"bytes"`
	Elapsed   float64         `json:"elapsed"`
	Latency   transferLatency `json:"latency"`
}

type pingResult struct {
	Jitter  float64 `json:"jitter"`
	Latency float64 `json:"latency"`
	Low     float64 `json:"low"`
	High    float64 `json:"high"`
}

type speedtestResult struct {
	Type       string         `json:"type"`
	Timestamp  string         `json:"timestamp"`
	Ping       pingResult     `json:"ping"`
	Download   transferResult `json:"download"`
	Upload     transferResult `json:"upload"`
	PacketLoss *float64       `json:"packetLoss"`
}

type exporter struct {
	command string
	args    []string
	timeout time.Duration

	downloadBandwidth *prometheus.Desc
	uploadBandwidth   *prometheus.Desc
	downloadLatency   *prometheus.Desc
	uploadLatency     *prometheus.Desc
	pingLatency       *prometheus.Desc
	pingJitter        *prometheus.Desc
	packetLoss        *prometheus.Desc
	scrapeDuration    *prometheus.Desc
	scrapeSuccess     *prometheus.Desc
}

func newExporter() *exporter {
	cmd := strings.TrimSpace(os.Getenv("SPEEDTEST_COMMAND"))
	if cmd == "" {
		cmd = "speedtest"
	}

	extraArgs := strings.Fields(strings.TrimSpace(os.Getenv("SPEEDTEST_ARGS")))

	timeout := 90 * time.Second
	if v := strings.TrimSpace(os.Getenv("SPEEDTEST_TIMEOUT")); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			timeout = parsed
		} else {
			log.Printf("failed to parse SPEEDTEST_TIMEOUT=%q: %v", v, err)
		}
	}

	return &exporter{
		command: cmd,
		args:    append([]string{"-f", "json-pretty", "--accept-license"}, extraArgs...),
		timeout: timeout,
		downloadBandwidth: prometheus.NewDesc(
			"speedtest_download_bandwidth_bits_per_second",
			"Download bandwidth reported by Ookla speedtest CLI in bits per second.",
			nil,
			nil,
		),
		uploadBandwidth: prometheus.NewDesc(
			"speedtest_upload_bandwidth_bits_per_second",
			"Upload bandwidth reported by Ookla speedtest CLI in bits per second.",
			nil,
			nil,
		),
		downloadLatency: prometheus.NewDesc(
			"speedtest_download_latency_seconds",
			"Download latency statistics reported by Ookla speedtest CLI (seconds).",
			[]string{"stat"},
			nil,
		),
		uploadLatency: prometheus.NewDesc(
			"speedtest_upload_latency_seconds",
			"Upload latency statistics reported by Ookla speedtest CLI (seconds).",
			[]string{"stat"},
			nil,
		),
		pingLatency: prometheus.NewDesc(
			"speedtest_ping_latency_seconds",
			"Ping latency statistics reported by Ookla speedtest CLI (seconds).",
			[]string{"stat"},
			nil,
		),
		pingJitter: prometheus.NewDesc(
			"speedtest_ping_jitter_seconds",
			"Ping jitter reported by Ookla speedtest CLI (seconds).",
			nil,
			nil,
		),
		packetLoss: prometheus.NewDesc(
			"speedtest_packet_loss_ratio",
			"Packet loss ratio (0-100) reported by Ookla speedtest CLI.",
			nil,
			nil,
		),
		scrapeDuration: prometheus.NewDesc(
			"speedtest_scrape_duration_seconds",
			"Duration of the Ookla speedtest CLI invocation in seconds.",
			nil,
			nil,
		),
		scrapeSuccess: prometheus.NewDesc(
			"speedtest_scrape_success",
			"Whether the latest scrape finished successfully (1) or resulted in an error (0).",
			nil,
			nil,
		),
	}
}

func (e *exporter) Describe(ch chan<- *prometheus.Desc) {
	ch <- e.downloadBandwidth
	ch <- e.uploadBandwidth
	ch <- e.downloadLatency
	ch <- e.uploadLatency
	ch <- e.pingLatency
	ch <- e.pingJitter
	ch <- e.packetLoss
	ch <- e.scrapeDuration
	ch <- e.scrapeSuccess
}

func (e *exporter) Collect(ch chan<- prometheus.Metric) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), e.timeout)
	defer cancel()

	result, err := e.runSpeedtest(ctx)
	if err != nil {
		log.Printf("speedtest scrape failed: %v", err)
		ch <- prometheus.MustNewConstMetric(e.scrapeSuccess, prometheus.GaugeValue, 0)
		ch <- prometheus.MustNewConstMetric(e.scrapeDuration, prometheus.GaugeValue, time.Since(start).Seconds())
		return
	}

	ch <- prometheus.MustNewConstMetric(
		e.downloadBandwidth,
		prometheus.GaugeValue,
		result.Download.Bandwidth*8,
	)

	ch <- prometheus.MustNewConstMetric(
		e.uploadBandwidth,
		prometheus.GaugeValue,
		result.Upload.Bandwidth*8,
	)

	for stat, value := range map[string]float64{
		"iqm":    result.Download.Latency.IQM / 1000.0,
		"low":    result.Download.Latency.Low / 1000.0,
		"high":   result.Download.Latency.High / 1000.0,
		"jitter": result.Download.Latency.Jitter / 1000.0,
	} {
		ch <- prometheus.MustNewConstMetric(e.downloadLatency, prometheus.GaugeValue, value, stat)
	}

	for stat, value := range map[string]float64{
		"iqm":    result.Upload.Latency.IQM / 1000.0,
		"low":    result.Upload.Latency.Low / 1000.0,
		"high":   result.Upload.Latency.High / 1000.0,
		"jitter": result.Upload.Latency.Jitter / 1000.0,
	} {
		ch <- prometheus.MustNewConstMetric(e.uploadLatency, prometheus.GaugeValue, value, stat)
	}

	for stat, value := range map[string]float64{
		"latency": result.Ping.Latency / 1000.0,
		"low":     result.Ping.Low / 1000.0,
		"high":    result.Ping.High / 1000.0,
	} {
		ch <- prometheus.MustNewConstMetric(e.pingLatency, prometheus.GaugeValue, value, stat)
	}

	ch <- prometheus.MustNewConstMetric(e.pingJitter, prometheus.GaugeValue, result.Ping.Jitter/1000.0)
	packetLoss := 0.0
	if result.PacketLoss != nil {
		packetLoss = *result.PacketLoss
	}
	ch <- prometheus.MustNewConstMetric(e.packetLoss, prometheus.GaugeValue, packetLoss)
	ch <- prometheus.MustNewConstMetric(e.scrapeSuccess, prometheus.GaugeValue, 1)
	ch <- prometheus.MustNewConstMetric(e.scrapeDuration, prometheus.GaugeValue, time.Since(start).Seconds())
}

func (e *exporter) runSpeedtest(ctx context.Context) (*speedtestResult, error) {
	fmt.Printf("running command: %s %s\n", e.command, strings.Join(e.args, " "))

	cmd := exec.CommandContext(ctx, e.command, e.args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		wrapped := fmt.Errorf("command failed: %w", err)
		if len(output) > 0 {
			wrapped = fmt.Errorf("%w: %s", wrapped, strings.TrimSpace(string(output)))
		}
		return nil, wrapped
	}

	var result speedtestResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to decode speedtest output: %w", err)
	}

	if result.Download.Bandwidth == 0 && result.Upload.Bandwidth == 0 {
		return nil, errors.New("speedtest output missing bandwidth data")
	}

	fmt.Printf("speedtest result: %+v\n", result)

	return &result, nil
}

func main() {
	listenAddr := strings.TrimSpace(os.Getenv("LISTEN_ADDRESS"))
	if listenAddr == "" {
		listenAddr = ":9801"
	}

	exp := newExporter()
	prometheus.MustRegister(exp)

	http.Handle("/metrics", promhttp.Handler())

	log.Printf("starting speedtest exporter on %s", listenAddr)
	if err := http.ListenAndServe(listenAddr, nil); err != nil {
		log.Fatalf("failed to start HTTP server: %v", err)
	}
}
