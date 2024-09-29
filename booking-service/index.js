require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const amqp = require('amqplib');
const cors = require('cors');  // Import the CORS middleware
const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',  // Allow only the Vue.js frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization']  // Allow these headers
}));

app.use(express.json());

// Load environment variables
const mysqlHost = process.env.MYSQL_HOST || 'mysql';
const mysqlUser = process.env.MYSQL_USER || 'user';
const mysqlPassword = process.env.MYSQL_PASSWORD || 'userpassword';
const mysqlDatabase = process.env.MYSQL_DB || 'hotel_db';
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
const port = process.env.PORT || 5001;

// MySQL connection
const db = mysql.createConnection({
  host: mysqlHost,
  user: mysqlUser,
  password: mysqlPassword,
  database: mysqlDatabase
});

// Function to connect to MySQL
function connectToDatabase() {
  db.connect(err => {
    if (err) {
      console.error('Error connecting to MySQL:', err.message);
      setTimeout(connectToDatabase, 5000); // Retry connection after 5 seconds
    } else {
      console.log('Connected to MySQL');
    }
  });
}
connectToDatabase();

// RabbitMQ connection
let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue('finance_queue');
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000); // Retry connection after 5 seconds
  }
}
connectRabbitMQ();

// Create a new booking
app.post('/bookings', (req, res) => {
  const { room_id, guest_name } = req.body;

  if (!room_id || !guest_name) {
    return res.status(400).json({ error: 'room_id and guest_name are required' });
  }

  const sql = 'INSERT INTO bookings (room_id, guest_name) VALUES (?, ?)';
  db.query(sql, [room_id, guest_name], (err, results) => {
    if (err) {
      console.error('Error inserting booking:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    // Send message to finance service
    const bookingId = results.insertId;
    const message = { room_id, guest_name, booking_id: bookingId };

    if (channel) {
      channel.sendToQueue('finance_queue', Buffer.from(JSON.stringify(message)));
      console.log('Sent message to finance_queue:', message);
    } else {
      console.error('RabbitMQ channel is not available');
    }

    res.status(201).json({ message: 'Booking created successfully', booking_id: bookingId });
  });
});

// Retrieve all bookings
app.get('/bookings', (req, res) => {
  const sql = 'SELECT * FROM bookings';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching bookings:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Booking Service is running on port ${port}`);
});
