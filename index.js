const fs = require('fs');
const path = require('path');
const { translate } = require('google-translate-api-browser');

const inputFile = process.argv[process.argv.indexOf('--input') + 1];
const languages = process.argv.find(arg => arg.startsWith('--langs=')).split('=')[1].split(',');

if (!inputFile || languages.length === 0) {
    console.error('Usage: pnpm run laquar --input <input_file_path> --langs=<comma_separated_languages>');
    process.exit(1);
}

const fileContent = fs.readFileSync(inputFile, 'utf-8');

// Regular expression to match service names and descriptions
const serviceRegex = /service\s+(\w+)\s*\("([^"]+)"\)/g;

// Extract service names and descriptions
const services = [];
let match;
while ((match = serviceRegex.exec(fileContent)) !== null) {
    services.push({ name: match[1], description: match[2] });
}

if (services.length === 0) {
    console.error('No services found in the input file.');
    process.exit(1);
}

// Function to split CamelCase into individual words
function splitCamelCase(input) {
    return input.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

// Function to capitalize the first letter of each word
function capitalizeFirstLetter(input) {
    return input.replace(/(^|\s)\S/g, match => match.toUpperCase());
}

// Create translated folder if not exists
const outputFolder = 'src/aqua/translated';
if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
}

// Translate and save code for each language
languages.forEach(lang => {
    Promise.all(
        services.map(service =>
            Promise.all(splitCamelCase(service.description).split(' ').map(word => translate(word, { to: lang })))
        )
    )
        .then(translations => {
            let currentIndex = 0;
            const translatedCode = fileContent.replace(serviceRegex, (_, serviceName) => {
                const translatedWords = translations[currentIndex++]
                    .map((translation, index) => {
                        if(index==0) return translation.text
                        // Check if translated text is in the English alphabet
                        // const isEnglishAlphabet = /^[a-zA-Z\s]+$/.test(translation.text);
                        // Capitalize the first letter of each word if in the English alphabet
                        return capitalizeFirstLetter(translation.text)
                    })
                    .join('');
                return `service ${serviceName}("${translatedWords}")`;
            });

            const outputFile = path.join(outputFolder, `${path.basename(inputFile, '.aqua')}_${lang}.aqua`);
            fs.writeFileSync(outputFile, translatedCode);
            console.log(`Translation for ${lang} saved to ${outputFile}`);
        })
        .catch(err => {
            console.error(`Error translating to ${lang}: ${err}`);
        });
});