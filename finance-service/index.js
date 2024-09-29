// index.js
require('dotenv').config();
const mysql = require('mysql2');
const amqp = require('amqplib');

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
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue('finance_queue');
    console.log('Connected to RabbitMQ, waiting for messages...');

    channel.consume('finance_queue', msg => {
      if (msg !== null) {
        const booking = JSON.parse(msg.content.toString());
        console.log('Received booking:', booking);

        // Handle financial transaction
        const sql = 'INSERT INTO finance (booking_id, amount) VALUES (?, ?)';
        const amount = 100; // Example amount

        db.query(sql, [booking.booking_id, amount], (err, results) => {
          if (err) {
            console.error('Error inserting finance record:', err.message);
          } else {
            console.log('Finance record inserted:', results.insertId);
          }
        });

        channel.ack(msg);
      }
    });
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000); // Retry after 5 seconds
  }
}

connectRabbitMQ();
