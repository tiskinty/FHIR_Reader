const fs = require('fs').promises;
const path = require('path');

//mastermodels = {};
var placeholder = process.argv[3] || "placeholder";

/*
function mergeProperties(target, source) {
    for (let key in source) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = {};
            }
            mergeProperties(target[key], source[key]);
        } else if (Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = [];
            }
            source[key].forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    if (!target[key][index]) {
                        target[key][index] = {};
                    }
                    mergeProperties(target[key][index], item);
                } else {
                    target[key][index] = "placeholder"; //item;
                }
            });
        } else {
                target[key] = "placeholder"; //source[key];
        }
    }
}
*/

function mergeProperties(target, source) {
    for (let key in source) {
        if (key === "resourceType") {
            // Use the source key value if the key is "resourceType"
            target[key] = source[key];
        } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = {};
            }
            mergeProperties(target[key], source[key]);
        } else if (Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = [];
            }
            source[key].forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    if (!target[key][index]) {
                        target[key][index] = {};
                    }
                    mergeProperties(target[key][index], item);
                } else {
                    target[key][index] = placeholder; // item;
                }
            });
        } else {
            target[key] = placeholder; // source[key];
        }
    }
}


function createModelsByResourceType(jsonObject, models) {
    if (jsonObject && Array.isArray(jsonObject.entry)) {
        jsonObject.entry.forEach(entry => {
            const resourceType = entry.resource.resourceType;
            if (!models[resourceType]) {
                models[resourceType] = {};
            }
            mergeProperties(models[resourceType], entry.resource);

        });
    }
    return models;
}

/*
// Function to read JSON files from a directory and process them
function processJsonFiles(directory) {
    var models = {};

    // Read all files in the directory
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Error reading directory: ${err.message}`);
            return;
        }

        // Filter out non-JSON files
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

        // Process each JSON file
        jsonFiles.forEach(file => {
            const filePath = path.join(directory, file);
            
            // Read the JSON file
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading file ${file}: ${err.message}`);
                    return;
                }

                try {
                    // Parse the JSON data
                    const jsonObject = JSON.parse(data);
                    
                    // Perform logic on the JSON object
                    models = performLogic(jsonObject, file, models);
                    //console.log(models);

                } catch (err) {
                    console.error(`Error parsing JSON in file ${file}: ${err.message}`);
                }
            });
        });
    });
    return models;
}
*/

async function processJsonFiles(directory) {
    let models = {};

    try {
        // Read all files in the directory
        const files = await fs.readdir(directory);

        // Filter out non-JSON files
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

        // Process each JSON file
        for (const file of jsonFiles) {
            const filePath = path.join(directory, file);
            
            // Read the JSON file
            const data = await fs.readFile(filePath, 'utf8');

            // Parse the JSON data
            const jsonObject = JSON.parse(data);

            // Perform logic on the JSON object
            models = performLogic(jsonObject, file, models);
        }

    } catch (err) {
        console.error(`Error processing files: ${err.message}`);
    }

    return models;
}

// Function to write the resulting JSON object to a file
function writeResultToFile(resultObject, directory, originalFileName) {
    // Create a new file name based on the original file name
    const newFileName = `_${originalFileName}`;
    const newFilePath = path.join(directory, newFileName);

    // Convert the result object to a JSON string
    const jsonString = JSON.stringify(resultObject, null, 2);

    // Write the JSON string to a new file
    fs.writeFile(newFilePath, jsonString, 'utf8', err => {
        if (err) {
            console.error(`Error writing file ${newFileName}: ${err.message}`);
            return;
        }
        console.log(`Result written to ${newFileName}`);
    });
}

// Function to perform logic on a JSON object
function performLogic(jsonObject, fileName, models) {
    // Create models by resourceType
    models = createModelsByResourceType(jsonObject, models);
    //console.log(JSON.stringify(models, null, 2));
    return models;
}

// Get the directory path from command-line arguments
const directory = process.argv[2];

if (!directory) {
    console.error('Please provide a directory path as a command-line argument.');
    process.exit(1);
}

// Run the script
//mastermodels = (async () => {
//    const models = await processJsonFiles(directory);
//    //console.log(models);
//})();//processJsonFiles(directory);
//console.log(mastermodels);
(async () => {
    const models = await processJsonFiles(directory);
    writeResultToFile(models, directory, 'models.json');
    //console.log(models);
})();