require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const amqp = require('amqplib'); // Import the amqplib library for RabbitMQ
const cors = require('cors');
const app = express();

app.use(cors());  // Enable CORS for all routes
app.use(express.json());

// Load environment variables
const mysqlHost = process.env.MYSQL_HOST || 'mysql';
const mysqlUser = process.env.MYSQL_USER || 'user';
const mysqlPassword = process.env.MYSQL_PASSWORD || 'userpassword';
const mysqlDatabase = process.env.MYSQL_DB || 'hotel_db';
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const PORT = process.env.PORT || 5003;

// MySQL connection
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

// RabbitMQ connection
let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue('customer_queue'); // Create a queue named customer_queue
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000); // Retry connection after 5 seconds
  }
}

connectRabbitMQ();

// Routes
app.post('/customers', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const sql = 'INSERT INTO customers (name, email) VALUES (?, ?)';

  db.query(sql, [name, email], (err, results) => {
    if (err) {
      console.error('Error inserting customer:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    // Publish a message to RabbitMQ
    const customerMessage = {
      customer_id: results.insertId,
      name: name,
      email: email
    };

    if (channel) {
      channel.sendToQueue('customer_queue', Buffer.from(JSON.stringify(customerMessage)));
      console.log('Sent message to customer_queue:', customerMessage);
    } else {
      console.error('RabbitMQ channel is not available');
    }

    res.status(201).json({ message: 'Customer created', customer_id: results.insertId });
  });
});

app.get('/customers', (req, res) => {
  const sql = 'SELECT * FROM customers';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching customers:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Customer Service is running on port ${PORT}`);
});
