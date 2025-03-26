import express, { Request, Response } from "express";

const app = express();
const port = 3000;

// Use JSON middleware
app.use(express.json());

// Expanded table data
const tables = [
  {
    tableId: "T001",
    capacity: 4,
    location: "Window",
    available: true,
  },
  {
    tableId: "T002",
    capacity: 2,
    location: "Corner",
    available: false,
  },
  {
    tableId: "T003",
    capacity: 6,
    location: "Center",
    available: true,
  },
  {
    tableId: "T004",
    capacity: 8,
    location: "Balcony",
    available: false,
  },
];

/**
 * GET /tables/:tableId
 * Returns the details of the specified table.
 */
app.get("/tables/:tableId", (req: Request, res: Response) => {
  const tableId = req.params.tableId;
  const table = tables.find((t) => t.tableId === tableId);
  if (table) {
    res.json(table);
  } else {
    res.status(404).json({ error: "Table not found" });
  }
});

/**
 * PUT /tables/:tableId
 * Updates the availability status of the specified table.
 * Expects a JSON body in the format: { "available": true/false }
 */
app.put("/tables/:tableId", (req: Request, res: Response) => {
  const tableId = req.params.tableId;
  const table = tables.find((t) => t.tableId === tableId);
  if (table) {
    // Validate input: ensure available is a boolean
    if (typeof req.body.available !== "boolean") {
      res
        .status(400)
        .json({ error: "Invalid 'available' value. It must be a boolean." });
    }

    table.available = req.body.available;
    res.json(table);
  } else {
    res.status(404).json({ error: "Table not found" });
  }
});

app.listen(port, () => {
  console.log(`Availability service listening at http://localhost:${port}`);
});
