// index.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const amqp = require('amqplib');
const app = express();

app.use(express.json());

const mysqlHost = process.env.MYSQL_HOST || 'mysql';
const mysqlUser = process.env.MYSQL_USER || 'user';
const mysqlPassword = process.env.MYSQL_PASSWORD || 'userpassword';
const mysqlDatabase = process.env.MYSQL_DB || 'hotel_db';

const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

// MySQL Connection
const db = mysql.createConnection({
  host: mysqlHost,
  user: mysqlUser,
  password: mysqlPassword,
  database: mysqlDatabase
});

function connectToDatabase() {
  db.connect(err => {
    if (err) {
      console.error('Error connecting to MySQL:', err.message);
      setTimeout(connectToDatabase, 5000); // Retry after 5 seconds
    } else {
      console.log('Connected to MySQL');
    }
  });
}

connectToDatabase();

// RabbitMQ Connection
let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue('finance_queue');
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000); // Retry after 5 seconds
  }
}

connectRabbitMQ();

// Routes
app.post('/book', (req, res) => {
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
    const message = { room_id, guest_name, booking_id: results.insertId };

    if (channel) {
      channel.sendToQueue('finance_queue', Buffer.from(JSON.stringify(message)));
      console.log('Sent message to finance_queue:', message);
    } else {
      console.error('RabbitMQ channel not available');
    }

    res.status(201).json({ message: 'Room booked successfully', booking_id: results.insertId });
  });
});

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

// Start server
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Hotel Service is running on port ${PORT}`);
});
