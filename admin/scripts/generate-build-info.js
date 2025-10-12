const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get the current git commit hash
  const commitHash = execSync('git rev-parse --short HEAD')
    .toString()
    .trim();

  // Create the build info object
  const buildInfo = {
    commitHash,
    buildTime: new Date().toISOString(),
  };

  // Write to a JSON file in the src directory
  const outputPath = path.join(__dirname, '../src/build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

  console.log('Build info generated successfully:', buildInfo);
} catch (error) {
  console.error('Error generating build info:', error.message);
  // Create a fallback build info
  const buildInfo = {
    commitHash: 'unknown',
    buildTime: new Date().toISOString(),
  };
  const outputPath = path.join(__dirname, '../src/build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));
}
