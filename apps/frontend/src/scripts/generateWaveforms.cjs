const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "/audio");
const OUTPUT_DIR = path.join(__dirname, "/waveforms_peaks");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const files = fs.readdirSync(INPUT_DIR).filter((f) =>
  [".wav", ".mp3", ".flac"].includes(path.extname(f))
);

for (const file of files) {
  const inputPath = path.join(INPUT_DIR, file);
  const base = path.basename(file, path.extname(file));
  const outputPath = path.join(OUTPUT_DIR, `${base}.json`);

  console.log(`Generating peaks for ${file} -> ${outputPath}`);


  const cmd = [
    path.join(__dirname, "audiowaveform.exe"),
    `-i "${inputPath}"`,
    `-o "${outputPath}"`,
    "-z 256",
    "--output-format json",
  ].join(" ");

  execSync(cmd, { stdio: "inherit" });
}
