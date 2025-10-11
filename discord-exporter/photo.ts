interface PhotoData {
  id: string;
  title: string;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: Date;
}

const photoData: PhotoData[] = [];

export const addPhoto = (data: PhotoData) => {
  photoData.push(data);
};

export const getPhotoHTML = (limit: number): string => {
  const photos = photoData.toSorted((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  ).slice(0, limit);

  return photos
    .map(
      (photo) => `
        <div class="photo-item" style="width: ${
        photo.width !== null && photo.height !== null
          ? `${(photo.width / photo.height) * 100}vh`
          : "auto"
      }">
          <figure>
            <img
              src="${photo.url}"
              alt=""
              width="${photo.width ?? "auto"}"
              height="${photo.height ?? "auto"}"
            >
            <figcaption>${photo.title}</figcaption>
          </figure>
        </div>
    `,
    )
    .join("");
};

export const getLatestPhotoId = (): string | null => {
  if (photoData.length === 0) return null;
  return photoData[photoData.length - 1]!.id;
};
