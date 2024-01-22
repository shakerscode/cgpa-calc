import express from "express";
import { PdfReader } from "pdfreader";
import cors from "cors";
import dotenv from "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";
import multer from "multer"; // Import multer

const app = express();
const port = process.env.PORT || 3002;

//middleware
app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.thqbd7f.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const partsCollection = client.db("localItems").collection("files");

    function parsePdf(buffer) {
      return new Promise((resolve, reject) => {
        const pdfTextItems = [];

        new PdfReader().parseBuffer(buffer, (err, item) => {
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
    app.post("/upload", upload.single("pdfFile"), async (req, res) => {
      try {
        const buffer = req.file.buffer;
        const pdfTextItems = await parsePdf(buffer);
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
        const includesMTH = (str, i) => {
          if (str.includes("MTH")) {
            return {
              subject: str,
              index: i,
            };
          }
          return null; // Return null for items that do not contain "CS"
        };

        // Filter the array to include only items that contain "CS"
        const csFields = jsonContent
          .map((item, index) => includesCS(item, index))
          .filter(Boolean);
        const mathFields = jsonContent
          .map((item, index) => includesMTH(item, index))
          .filter(Boolean);

        const csSubjectsWithCGPA = csFields
          .map((subject, i) => {
            const gpa = Number(jsonContent[subject?.index + 2]).toFixed(2);
            const grd = jsonContent[subject?.index + 3];

            // Check if grd is not null and follows the expected structure
            if (gpa && typeof gpa !== null) {
              return {
                ...subject,
                gpa: gpa,
                grd,
              };
            }

            return null; // Exclude items that don't match the structure
          })
          .filter(Boolean);

        // Extract Earn CGPA for each MTH subject
        const mathSubjectsWithCGPA = mathFields
          .map((subject, i) => {
            const gpa = jsonContent[subject?.index + 2];
            const grd = jsonContent[subject?.index + 3];

            // Check if grd is not null and follows the expected structure
            if (grd && typeof grd === "string" && grd.trim().length > 0) {
              return {
                ...subject,
                gpa: Number(gpa),
                grd,
              };
            }

            return null; // Exclude items that don't match the structure
          })
          .filter(Boolean);

        res.setHeader("Content-Type", "application/pdf");
        res.send([...csSubjectsWithCGPA, ...mathSubjectsWithCGPA]);
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .send("Error processing PDF and generating JSON response");
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

// Define Ïa simple route

app.get("/", (req, res) => {
  res.send("Hello, this is your Node.js server!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
