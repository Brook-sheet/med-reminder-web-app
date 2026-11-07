import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("public/pwa", { recursive: true });

const logo = "public/brand/icon.png";

async function image(width, height, logoSize, path) {
  const mark = await sharp(logo)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: "#ffffff",
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      {
        input: mark,
        gravity: "centre",
      },
    ])
    .png()
    .toFile(path);
}

for (const size of [192, 512]) {
  await image(
    size,
    size,
    size,
    `public/pwa/icon-${size}.png`
  );
}

await image(
  512,
  512,
  300,
  "public/pwa/maskable-512.png"
);

await image(
  180,
  180,
  160,
  "public/pwa/apple-touch-icon.png"
);

const screens = [
  [320, 568, 2],
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
  [768, 1024, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

const links = [];

for (const [width, height, dpr] of screens) {
  for (const landscape of [false, true]) {
    const orientation = landscape
      ? "landscape"
      : "portrait";

    const name =
      `splash-${width}-${height}-${dpr}-${orientation}.png`;

    await image(
      (landscape ? height : width) * dpr,
      (landscape ? width : height) * dpr,
      120 * dpr,
      `public/pwa/${name}`
    );

    links.push({
      url: `/pwa/${name}`,
      media:
        `(device-width: ${width}px) and ` +
        `(device-height: ${height}px) and ` +
        `(-webkit-device-pixel-ratio: ${dpr}) and ` +
        `(orientation: ${orientation})`,
    });
  }
}

await mkdir("lib/pwa", { recursive: true });

await writeFile(
  "lib/pwa/splash.json",
  JSON.stringify(links, null, 2)
);

console.log(
  "PWA icons and splash screens generated."
);