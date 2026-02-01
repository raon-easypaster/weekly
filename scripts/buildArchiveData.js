const fs = require('fs');
const path = require('path');

const ARCHIVE_ROOT = path.join(__dirname, '..');
const DATA_OUTPUT = path.join(__dirname, '..', 'data', 'archiveData.js');
const EXCLUDE_DIRS = ['.git', 'node_modules', 'scripts', 'data', '.gemini', '.agent'];

function getAllHtmlFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                arrayOfFiles = getAllHtmlFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.html') && file !== 'index.html') {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function extractMetadata(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(ARCHIVE_ROOT, filePath);
    const fileName = path.basename(filePath);

    // Extract Title
    let title = 'Untitled';
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(/ - 주간 묵상집/g, '').trim();
    }

    // Extract Scripture (from various patterns observed in reference)
    let scripture = '';
    // Pattern 1: <div class="main-scripture">본문: 로마서 16:1-2</div>
    const scriptureMatch = content.match(/<div class="main-scripture">본문:\s*(.*?)<\/div>/i);
    if (scriptureMatch && scriptureMatch[1]) {
        scripture = scriptureMatch[1].trim();
    } else {
        // Pattern 2: scripture-box
        const scriptureBoxMatch = content.match(/<div class="scripture-box">(.*?)<\/div>/i);
        if (scriptureBoxMatch && scriptureBoxMatch[1]) {
            scripture = scriptureBoxMatch[1].trim();
        } else {
            // Pattern 3: guide-info with "|" separator
            const guideInfoMatch = content.match(/<div class="guide-info">.*?\|\s*(.*?)<\/div>/i);
            if (guideInfoMatch && guideInfoMatch[1]) {
                scripture = guideInfoMatch[1].trim();
            }
        }
    }

    // Extract Date from filename or content
    // Priority: YYYY-MM-DD, YYYYMMDD, YYMMDD
    let date = '';
    const dateDashMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    const dateFullMatch = fileName.match(/(\d{4})(\d{2})(\d{2})/);
    const shortDateMatch = fileName.match(/(\d{2})(\d{2})(\d{2})/);

    if (dateDashMatch) {
        date = dateDashMatch[1];
    } else if (dateFullMatch) {
        date = `${dateFullMatch[1]}-${dateFullMatch[2]}-${dateFullMatch[3]}`;
    } else if (shortDateMatch) {
        date = `20${shortDateMatch[1]}-${shortDateMatch[2]}-${shortDateMatch[3]}`;
    }

    // If still no date, try extracting from content
    if (!date) {
        const contentDateMatch = content.match(/<span class="date-range">(.*?)<\/span>|<div class="guide-info">(.*?)<\/div>/i);
        const matchText = contentDateMatch ? (contentDateMatch[1] || contentDateMatch[2]) : '';
        if (matchText) {
            const foundDate = matchText.match(/(\d{4})[\.\- ](\d{1,2})[\.\- ](\d{1,2})/);
            if (foundDate) {
                date = `${foundDate[1]}-${foundDate[2].padStart(2, '0')}-${foundDate[3].padStart(2, '0')}`;
            }
        }
    }

    return {
        title,
        scripture,
        date,
        url: relativePath.split(path.sep).join('/'), // Force forward slashes
        fileName
    };
}

function build() {
    console.log('Scanning for HTML files...');
    const htmlFiles = getAllHtmlFiles(ARCHIVE_ROOT);
    const archiveData = [];

    htmlFiles.forEach(file => {
        try {
            const metadata = extractMetadata(file);
            if (metadata.date) {
                archiveData.push(metadata);
            } else {
                console.warn(`⚠️ Skipped ${path.basename(file)}: Could not extract date.`);
            }
        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err);
        }
    });

    // Sort by date descending
    archiveData.sort((a, b) => new Date(b.date) - new Date(a.date));

    const outputContent = `window.ARCHIVE_DATA = ${JSON.stringify(archiveData, null, 2)};`;

    fs.writeFileSync(DATA_OUTPUT, outputContent);
    console.log(`Successfully generated archive data for ${archiveData.length} files.`);
}

build();
