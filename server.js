import express from "express";
import { PdfReader } from "pdfreader";

const app = express();
const port = 3002;

function parsePdf() {
  return new Promise((resolve, reject) => {
    const pdfTextItems = [];

    new PdfReader().parseFileItems("transcript.pdf", (err, item) => {
      try {
        if (err) {
          reject(err);
          return;
        }

        if (item?.text) {
          const termSections = item?.text.split("Term");

          pdfTextItems.push(item.text);
          // console.log(item?.text);
        } else if (item === undefined) {
          // Resolve the promise when parsing is done
          resolve(pdfTextItems);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Define a simple route to save the text as JSON
app.get("/getJson", async (req, res) => {
  try {
    const pdfTextItems = await parsePdf();
    const jsonContent = JSON.parse(JSON.stringify(pdfTextItems));

    const includesCS = (str, i) => {
        if (str.includes("CS")) {
          return {
            subject: str,
            index: i,
          };
        }
        return null; // Return null for items that do not contain "CS"
      };
      
      // Filter the array to include only items that contain "CS"
      const csFields = jsonContent.map((item, index) => includesCS(item, index)).filter(Boolean);


    // Extract Earn CGPA for each CS subject
    const csSubjectsWithCGPA = csFields.map((subject, i) => {
        // Define the range to search for "Earn" CGPA
        const gpa = jsonContent[subject?.index+2];
        const grd = jsonContent[subject?.index+3];
 
      return {
        ...subject,
        gpa: Number(gpa),
        grd
      };
    });
 
    res.setHeader("Content-Type", "application/json");
    res.send(csSubjectsWithCGPA);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error processing PDF and generating JSON response");
  }
});

// Define Ïa simple route

app.get("/", (req, res) => {
  res.send("Hello, this is your Node.js server!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
