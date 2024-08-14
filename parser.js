const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

function model(modelName) {
    const model = {
        "procedure": {},
        "patient": {},
        "encounter": {},
        "condition": {},
        "observation": {},
    };

    return model[modelName.toLowerCase()];
}

function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

const printJsonKeys = (obj, prefix = '') => {
    var stack = `<p>`;
    for (const key in obj) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        stack += `${newPrefix}<br>`;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            printJsonKeys(obj[key], newPrefix);
        }
    }
    return stack+`</p>`;
};

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
                    target[key][index] = item;
                }
            });
        } else {
            target[key] = source[key];
        }
    }
}

function createModelObject(jsonArray) {
    const model = {};
    jsonArray.forEach(entry => {
        mergeProperties(model, entry.resource);
    });
    return model;
}

function mergeWithModel(model, data, placeholder = "Not provided") {
    const merged = Array.isArray(model) ? [] : {};

    for (let key in model) {
        if (typeof model[key] === 'object' && model[key] !== null) {
            merged[key] = mergeWithModel(model[key], data[key] !== undefined ? data[key] : undefined, placeholder);
        } else {
            merged[key] = data && data[key] !== undefined ? data[key] : placeholder;
        }
    }

    if (Array.isArray(model)) {
        for (let i = 0; i < model.length; i++) {
            merged[i] = mergeWithModel(model[i], data && data[i] !== undefined ? data[i] : undefined, placeholder);
        }
    }

    return merged;
}

// Function to parse FHIR document and generate HTML
function parseFhirDocument(filePath) {
    const fhirData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Extract specified fields
    const patient = fhirData.entry[0].resource.resourceType === 'Patient' ? fhirData.entry[0].resource : {};
    const name = patient.name ? (isArray(patient.name[0].given) ? patient.name[0].given.join(' ') : patient.name[0].given) + ' ' + patient.name[0].family : 'N/A';
    const gender = patient.gender || 'N/A';
    const birthDate = patient.birthDate || 'N/A';
    const address = patient.address ? patient.address[0].city : 'N/A';

    // Function to recursively build HTML for all fields
    function buildHtmlForFields(data, indent = 0) {
        let html = '';
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                const indentation = '&nbsp;'.repeat(indent * 4);
                if (typeof value === 'object' && value !== null) {
                    html += `<div>${indentation}<strong>${key}:</strong></div>`;
                    html += buildHtmlForFields(value, indent + 1);
                } else {
                    html += `<div>${indentation}<strong>${key}:</strong> ${value}</div>`;
                }
            }
        }
        return html;
    }

    const otherFieldsHtml = generateHtml(fhirData);

    // Generate HTML content
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FHIR Document</title>
            <style>
                body { font-family: Arial, sans-serif; }
                .container { width: 90%; margin: auto; padding: 20px; border: 1px solid #ddd; }
                h1 { text-align: center; }
                .info { margin-bottom: 20px; }
                .info span { font-weight: bold; }
                .fields { margin-top: 40px; }
                .fields div { margin-bottom: 10px; }
                .outerresource { border: 1px solid #ccc; padding: 3px; margin: 3px 0; }
                .resource { border: 1px solid #ccc; padding: 3px; margin: 3px 0; }
                .resource h2 { margin-top: 0; }
                #label { font-weight: bold; position: absolute; left: 20px; top: -10px; border: 1px solid #ccc; background: #000; text-align: center;}
                .content { display: none; overflow: hidden; transition: max-height 0.2s ease-out; }
                .active .content { display: block; }
            </style>
            
        </head>
        <body>
            <div class="container">
                <h1>Patient Information</h1>
                <div class="info">
                    <span>Name:</span> ${name}
                </div>
                <div class="info">
                    <span>Gender:</span> ${gender}
                </div>
                <div class="info">
                    <span>Birth Date:</span> ${birthDate}
                </div>
                <div class="info">
                    <span>Address:</span> ${address}
                </div>
                <div class="fields">
                    <h2>Events</h2>
                    ${otherFieldsHtml}
                </div>
            </div>
            <script>
                function toggleContent(event) {
                    const content = this.nextElementSibling;
                    content.style.display = content.style.display === 'block' ? 'none' : 'block';
                }
                document.querySelectorAll('.resource').forEach(el => el.addEventListener('click',toggleContent));
            </script>
        </body>
        </html>
    `;

    return htmlContent;
}

const generateHtml = (document) => {
    let htmlContent = ``;

    document.entry.forEach(entry => {
        const resource = entry.resource;

        const filter = ['MedicationRequest',/*'Procedure',*/'Patient', 'Encounter', 'Condition', 'Observation', 'Immunization', 'DiagnosticReport', 'DocumentReference'].includes(resource.resourceType);

        if(!filter) {
        htmlContent += `<div class="outerresource">`;

        if (resource.resourceType === 'Patient' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Name:</strong> ${resource.name[0].given.join(' ')} ${resource.name[0].family}</p>` +
                `<p><strong>Gender:</strong> ${resource.gender}</p>` +
                `<p><strong>Birth Date:</strong> ${resource.birthDate}</p>` +
                `<p><strong>Address:</strong> ${resource.address[0].line.join(', ')}, ${resource.address[0].city}, ${resource.address[0].state} ${resource.address[0].postalCode}, ${resource.address[0].country}</p>` +
                `<p><strong>Race:</strong> ${resource.extension[0].extension[1].valueString}</p>` +
                `<p><strong>Ethnicity:</strong> ${resource.extension[1].extension[1].valueString}</p>` +
                `<p><strong>Language:</strong> ${resource.communication[0].language.coding[0].display}</p>` +
                `<p><strong>Marital Status:</strong> ${resource.maritalStatus.text}</p>` +
                `<p><strong>Multiple Birth:</strong> ${resource.multipleBirthBoolean}</p>` +
                `<p><strong>Mothers Maiden Name:</strong> ${resource.extension[2].valueString}</p>` +
                `<p><strong>Phone:</strong> ${resource.telecom[0].value}</p>` +
                `<p><strong>Disability Adjusted Life Years:</strong> ${resource.extension[5].valueDecimal}</p>` +
                `<p><strong>Quality Adjusted Life Years:</strong> ${resource.extension[6].valueDecimal}</p>` +
                `<p><strong>Medical Record Number:</strong> ${resource.identifier[0].value}</p>` +
                `<p><strong>Assigned Sex at Birth:</strong> ${resource.extension[3].valueCode}</p>` +
                `<p><strong>Birthplace:</strong> ${resource.extension[4].valueAddress.city + ', ' + resource.extension[4].valueAddress.state}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'Encounter' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Type:</strong> ${resource.type[0].coding[0].display}</p>` +
                `<p><strong>Period:</strong> ${resource.period.start} - ${resource.period.end}</p>` +
                `<p><strong>Location:</strong> ${resource.location[0].location.display}</p>` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Class:</strong> ${resource.class.code}</p>` +
                `<p><strong>Performer</strong> ${resource.participant[0].individual.display}</p>` +
                `<p><strong>Period:</strong> ${resource.period.start} - ${resource.period.end}</p>` +
                `<p><strong>Service Provider:</strong> ${resource.serviceProvider.display}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'Condition' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Clinical Status:</strong> ${resource.clinicalStatus.coding[0].code}</p>` +
                `<p><strong>Verification Status:</strong> ${resource.verificationStatus.coding[0].code}</p>` +
                `<p><strong>Category:</strong> ${resource.category[0].coding[0].display}</p>` +
                `<p><strong>Diagnosis:</strong> ${resource.code.coding[0].display}</p>` +
                `<p><strong>Code:</strong> ${resource.code.coding[0].code}</p>` +
                `<p><strong>Onset Date:</strong> ${resource.onsetDateTime}</p>` +
                `<p><strong>Abatement Date:</strong> ${resource.abatementDateTime}</p>` +
                `<p><strong>Recorded Date:</strong> ${resource.recordedDate}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'Observation' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Category:</strong> ${resource.category[0].coding[0].display}</p>` +
                `<p><strong>Code:</strong> ${resource.code.coding[0].display}</p>` +
                `<p><strong>Effective Date:</strong> ${resource.effectiveDateTime}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'Immunization' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Vaccine Code:</strong> ${resource.vaccineCode.coding[0].display}</p>` +
                `<p><strong>Occurrence Date:</strong> ${resource.occurrenceDateTime}</p>` +
                `<p><strong>Primary Source:</strong> ${resource.primarySource}</p>` +
                `<p><strong>Vaccinating Clinic:</strong> ${resource.location.display}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'DiagnosticReport' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Category:</strong> ${resource.category[0].coding[0].display}</p>` +
                `<p><strong>Code:</strong> ${resource.code.coding[0].display}</p>` +
                `<p><strong>Effective Date:</strong> ${resource.effectiveDateTime}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'DocumentReference' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Type:</strong> ${resource.type.coding[0].display}</p>` +
                `<p><strong>Date:</strong> ${resource.date}</p>` +
                `<p><strong>Data:</strong> ${new Buffer(resource.content[0].attachment.data, 'base64').toString('ascii').replace(/\n/g, '<br>')}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'MedicationRequest' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Intent:</strong> ${resource.intent}</p>` +
                `<p><strong>Medication:</strong> ${resource.medicationCodeableConcept.text}</p>` +
                `<p><strong>Medication Code:</strong> ${resource.medicationCodeableConcept.coding[0].code}</p>` +
                `<p><strong>Dosage Instructions:</strong> ${resource?.dosageInstruction?.[0]?.text ?? 'N/A'}</p>` +
                `<p><strong>As Needed?:</strong> ${resource?.dosageInstruction?.[0]?.asNeededBoolean ?? 'N/A'}</p>` +
                `<p><strong>Authored Date:</strong> ${resource.authoredOn}</p>` +
                `<p><strong>Requester:</strong> ${resource.requester.display}</p>` +
                `<p><strong>Category:</strong> ${resource.category[0].coding[0].display}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } else if (resource.resourceType === 'Procedure' && !filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<p><strong>Status:</strong> ${resource.status}</p>` +
                `<p><strong>Procedure:</strong> ${resource.code.coding[0].display}</p>` +
                `<p><strong>Procedure Code:</strong> ${resource.code.coding[0].code}</p>` +
                `<p><strong>Performed Period:</strong> ${resource.performedPeriod.start} - ${resource.performedPeriod.end}</p>` +
                `<p><strong>Performed At Location:</strong> ${resource.location.display}</p>` +
                `<p><strong>Reason:</strong> ${resource?.reasonReference?.[0]?.display ?? 'N/A'}</p>` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `${printJsonKeys(resource)}`;
            htmlContent += `</div>`;
        } 
        else if (!filter) {
            htmlContent += `<div class="resource"><h3>${resource.resourceType}</h3><p><i>${resource.id}</i></p></div>`;
            htmlContent += `<div class="content">` +
                `<textarea rows="4" cols="50">${JSON.stringify(entry,null,4)}</textarea>`;
            htmlContent += `</div>`;
        }

        htmlContent += `</div>`;
    }
    });


    //    htmlContent += `
    //      </body>
    //      </html>
    //    `;

    return htmlContent;
};

// Route to serve FHIR document as HTML
app.get('/fhir/:file', (req, res) => {
    const filePath = path.join(__dirname, req.params.file);

    if (fs.existsSync(filePath)) {
        const htmlContent = parseFhirDocument(filePath);
        res.send(htmlContent);
    } else {
        res.status(404).send('File not found');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});