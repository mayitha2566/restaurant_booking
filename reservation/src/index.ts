import express, { Request, Response } from 'express';

// If you're using Node.js version <18, you may need to install and import node-fetch:
// import fetch from 'node-fetch';

const app = express();
const port = 3001;

app.use(express.json());

// Sample Customers Data
const customers = [
  {
    customerId: "C101",
    name: "John Doe",
    email: "john.doe@example.com"
  },
  {
    customerId: "C102",
    name: "Jane Smith",
    email: "jane.smith@example.com"
  },
  {
    customerId: "C103",
    name: "Sam Wilson",
    email: "sam.wilson@example.com"
  },
  {
    customerId: "C104",
    name: "Emily Davis",
    email: "emily.davis@example.com"
  }
];

// Reservations storage
interface Reservation {
  reservationId: string;
  tableId: string;
  customerId: string;
  status: string;
}
const reservations: Reservation[] = [];

// Waitlist storage (mapping tableId to an array of waitlisted customer requests)
interface WaitlistEntry {
  customerId: string;
  preferences: string[];
}
const waitlists: { [tableId: string]: WaitlistEntry[] } = {
  "T002": [
    { customerId: "C101", preferences: ["Window", "Quiet"] },
    { customerId: "C102", preferences: ["Corner", "Loud"] },
    { customerId: "C103", preferences: ["Center", "Quiet"] }
  ]
};

// Utility function to call the Availability Microservice GET endpoint
const getTable = async (tableId: string): Promise<any> => {
  const response = await fetch(`http://localhost:3000/tables/${tableId}`);
  if (!response.ok) {
    throw new Error('Table not found');
  }
  return response.json();
};

// Utility function to update table availability via the Availability Microservice using PUT
const updateTableAvailability = async (tableId: string, available: boolean): Promise<any> => {
  const response = await fetch(`http://localhost:3000/tables/${tableId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ available })
  });
  if (!response.ok) {
    throw new Error('Failed to update table availability');
  }
  return response.json();
};

/**
 * POST /reservations
 * Processes a reservation request or cancellation.
 * Request body should contain:
 * - tableId (string)
 * - customerId (string)
 * - reservationType (string): "reserve" or "cancel"
 * - preferences (array of strings, optional)
 */
app.post('/reservations', async (req: Request, res: Response) => {
  const { tableId, customerId, reservationType, preferences } = req.body;

  // Validate reservation type
  if (reservationType !== 'reserve' && reservationType !== 'cancel') {
    res.status(400).json({ error: 'Invalid reservation type' });
  }

  try {
    // Try to get table details from Availability Microservice
    const table = await getTable(tableId);

    // If it's a reservation request
    if (reservationType === 'reserve') {
      if (table.available) {
        // Confirm reservation by updating availability to false
        await updateTableAvailability(tableId, false);
        const reservationId = `R${reservations.length + 1}`;
        reservations.push({
          reservationId,
          tableId,
          customerId,
          status: 'confirmed'
        });
        res.json({ reservationId, status: 'success', tableId });
      } else {
        // Add to waitlist: if waitlist exists, append; otherwise, create new queue
        if (!waitlists[tableId]) {
          waitlists[tableId] = [];
        }
        waitlists[tableId].push({ customerId, preferences: preferences || [] });
        const position = waitlists[tableId].length;
        res.json({
          reservationId: null,
          status: 'waitlisted',
          waitlistMessage: `You are #${position} in the queue.`
        });
      }
    } 
    // Cancellation request
    else if (reservationType === 'cancel') {
      // Find and remove the confirmed reservation (if any)
      const reservationIndex = reservations.findIndex(r => r.tableId === tableId && r.customerId === customerId);
      if (reservationIndex !== -1) {
        const removedReservation = reservations.splice(reservationIndex, 1)[0];
        // Check if there is a waitlisted customer for the table
        if (waitlists[tableId] && waitlists[tableId].length > 0) {
          // Get the next customer from the waitlist
          const nextInLine = waitlists[tableId].shift();
          // Confirm the reservation for the waitlisted customer
          const newReservationId = `R${reservations.length + 1}`;
          reservations.push({
            reservationId: newReservationId,
            tableId,
            customerId: nextInLine!.customerId,
            status: 'confirmed'
          });
          // Table remains unavailable as it gets reserved by the next waitlisted customer
          res.json({
            reservationId: removedReservation.reservationId,
            status: 'cancelled',
            tableId,
            message: `Reservation cancelled. Customer ${nextInLine!.customerId} has been confirmed from the waitlist as ${newReservationId}.`
          });
        } else {
          // No one is on the waitlist: update table availability to true
          await updateTableAvailability(tableId, true);
          res.json({
            reservationId: removedReservation.reservationId,
            status: 'cancelled',
            tableId,
            message: 'Reservation cancelled and table is now available.'
          });
        }
      } else {
        // No confirmed reservation found for this customer at the table
        // In this case, if customer is on the waitlist, remove them from it
        if (waitlists[tableId]) {
          const waitlistIndex = waitlists[tableId].findIndex(w => w.customerId === customerId);
          if (waitlistIndex !== -1) {
            waitlists[tableId].splice(waitlistIndex, 1);
            res.json({
              reservationId: null,
              status: 'cancelled',
              tableId,
              message: 'Removed from waitlist.'
            });
          }
        }
        res.status(404).json({ error: 'Reservation not found for cancellation' });
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Reservation processing failed' });
  }
});

app.listen(port, () => {
  console.log(`Reservation service listening at http://localhost:${port}`);
});
