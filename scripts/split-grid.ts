import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function splitGrid(
  imagePath: string,
  outputDir: string,
  gridCols: number = 3,
  gridRows: number = 3
) {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Load the image
  const image = await loadImage(imagePath);
  const { width, height } = image;

  // Calculate tile dimensions
  const tileWidth = Math.floor(width / gridCols);
  const tileHeight = Math.floor(height / gridRows);

  console.log(`Image size: ${width}x${height}`);
  console.log(`Tile size: ${tileWidth}x${tileHeight}`);
  console.log(`Grid: ${gridCols}x${gridRows} = ${gridCols * gridRows} tiles`);

  let index = 0;
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      // Create canvas for this tile
      const canvas = createCanvas(tileWidth, tileHeight);
      const ctx = canvas.getContext("2d");

      // Draw the portion of the image
      ctx.drawImage(
        image,
        col * tileWidth,
        row * tileHeight,
        tileWidth,
        tileHeight,
        0,
        0,
        tileWidth,
        tileHeight
      );

      // Save the tile
      const outputPath = join(outputDir, `${index}.png`);
      const buffer = canvas.toBuffer("image/png");
      writeFileSync(outputPath, buffer);
      console.log(`Saved: ${outputPath}`);

      index++;
    }
  }

  console.log(`\nDone! ${index} tiles saved to ${outputDir}`);
}

// Get image path from command line args
const imagePath = process.argv[2];
if (!imagePath) {
  console.error("Usage: pnpm tsx split-grid.ts <image-path> [cols] [rows]");
  process.exit(1);
}

const cols = parseInt(process.argv[3]) || 3;
const rows = parseInt(process.argv[4]) || 3;

splitGrid(imagePath, "./textures", cols, rows);
