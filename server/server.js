import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import sharp from 'sharp';

import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});


const userSockets = new Map();


io.on("connection", (socket) => {
  socket.on("authenticate", (token) => {
    console.log("Authentication attempt");
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      userSockets.set(user.userId, socket);
      socket.userId = user.userId;
      console.log("Socket authenticated for user:", user.userId);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.userId);
        userSockets.delete(socket.userId);
      });
    } catch (err) {
      console.error("Socket authentication failed:", err);
      socket.disconnect();
    }
  });

  socket.on("send_message", async (data) => {
    console.log("Message received:", data);
    try {
      if (!data || typeof data !== "object") {
        socket.emit("message_error", { message: "Invalid message data" });
        return;
      }

      const user = await getUserFromSocket(socket);
      if (!user) {
        socket.emit("message_error", { message: "Authentication required" });
        return;
      }

      if (
        typeof data.conversationId === "undefined" ||
        data.conversationId === null
      ) {
        socket.emit("message_error", { message: "Missing conversationId" });
        return;
      }
      const conversationId = Number(data.conversationId);

      const content = data.content ? String(data.content).trim() : null;
      if (!content) {
        socket.emit("message_error", { message: "Missing message content" });
        return;
      }

      const [participants] = await pool.execute(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [conversationId, user.userId]
      );

      if (participants.length === 0) {
        socket.emit("message_error", {
          message: "Not authorized for this conversation",
        });
        return;
      }

      // Insert message with validated data
      const [result] = await pool.execute(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
        [conversationId, user.userId, content]
      );

      // Get the inserted message with sender info
      const [messageData] = await pool.execute(
        `SELECT m.*, u.username as sender_name 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.id = ?`,
        [result.insertId]
      );

      // Emit to all participants
      const [conversationParticipants] = await pool.execute(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = ?",
        [conversationId]
      );

      const newMessage = messageData[0];
      conversationParticipants.forEach(({ user_id }) => {
        const recipientSocket = userSockets.get(user_id);
        if (recipientSocket) {
          recipientSocket.emit("new_message", newMessage);
        }
      });
    } catch (error) {
      console.error("Message handling error:", error);
      socket.emit("message_error", {
        message: "Failed to process message",
      });
    }
  });


  socket.on("avatar_updated", (userId) => {
    io.emit("avatar_changed", userId);
  });

  socket.on("friend_request_sent", (targetUserId) => {
    const targetSocket = userSockets.get(parseInt(targetUserId));
    if (targetSocket) {
      targetSocket.emit("new_friend_request");
    }
  });

  socket.on("friend_request_accepted", (requesterId) => {
    const requesterSocket = userSockets.get(parseInt(requesterId));
    if (requesterSocket) {
      requesterSocket.emit("contact_list_updated");
    }
    socket.emit("contact_list_updated");
  });

});

async function getUserFromSocket(socket) {
  if (!socket.userId) return null;
  const [users] = await pool.execute(
    "SELECT id as userId, username FROM users WHERE id = ?",
    [socket.userId]
  );
  return users.length > 0 ? users[0] : null;
}



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
})

const pool = mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({message: 'no token'});

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({message: 'invalid token'});
        if (!user || !user.userId) return res.status(403).json({message: 'invalid token payload'});
        req.user = user;
        next();
    });
};

function generateGuestUsername() {
  const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
  return `guest_${randomNum}`;
}


app.get("/api/contacts", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
            SELECT u.id, u.username 
            FROM users u
            INNER JOIN contacts c ON u.id = c.contact_id
            WHERE c.user_id = ?
        `,
      [req.user.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post('/api/login', async (req, res) => {
    const {username, password} = req.body;

    try {
        const [rows] = await  pool.execute (
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0 ) {
            return res.status(401).json({message: 'username not found'});
        }

        if (rows.length > 1 ) {
            return res.status(500).json({message: 'multiple users found'});
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({message: 'incorrect password'});
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({token, username:user.username});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'internal server error'});
    }
});

app.post('/api/register', async (req, res) => {
    const {username, email, password} = req.body;

    try { 
        const [existing] = await pool.execute ( 
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

    if ( existing.length > 0 ) {
        return res.status(400).json({message: 'username or email already in use'});
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000); 

    const salt = 10;
    const passwordHash = await bcrypt.hash(password, salt);
    
    await pool.execute(
            `INSERT INTO verification_codes 
            (email, code, username, password_hash, expires_at) 
            VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
            ON DUPLICATE KEY UPDATE 
            code = VALUES(code),
            username = VALUES(username),
            password_hash = VALUES(password_hash),
            expires_at = VALUES(expires_at)`,
            [email, verificationCode, username, passwordHash]
        );

    const mailOptions= {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Hoppon Account Verification',
        html:`
            <h1 style="text-align: center; color:magenta;">Welcome to Hoppon!</h1>
            <p style="text-align: center;">Your verification code is: <strong>${verificationCode} </strong></p>
            <p> code will expire in 10 minutes</p>
        `
    };

    await transporter.sendMail(mailOptions);
    res.json({message: 'verification email sent'});
} catch (error) {
    console.error(error);
    res.status(500).json({message: 'internal server error'});
}
});

app.post("/api/verify", async (req, res) => {
  const { email, code } = req.body;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM verification_codes WHERE email = ? AND expires_at > NOW()",
      [email]
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code" });
    }

    const userData = rows[0];

    if (userData.code !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const [userResult] = await pool.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [userData.username, email, userData.password_hash]
    );

    await pool.execute("DELETE FROM verification_codes WHERE email = ?", [
      email,
    ]);

    const token = jwt.sign(
      {
        userId: userResult.insertId,
        username: userData.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Account verified",
      token,
      username: userData.username,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post('/api/guest/create', async (req, res) => {
    try {
        let username;
        let isUnique = false;

        while(!isUnique) {
            username = generateGuestUsername();
            const [existing ] = await pool.execute(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            if(existing.length === 0) {
                isUnique = true;
            }
        }

        const tempPassword = Math.random().toString(36).slice(-10);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, `${username}@guest.local`, hashedPassword]
            );

            await connection.execute(
                `INSERT INTO guests (user_id) VALUES (?)`,
                [userResult.insertId]
            );

            await connection.commit();

            const token = jwt.sign(
                { userId: userResult.insertId, username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ 
                token,
                username,
                message: 'Guest account created successfully',
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating guest account:', error);
        res.status(500).json({ message: 'Failed to create guest account' });
    }
});



app.post("/api/conversations", authenticateToken, async (req, res) => {
  const { participantIds } = req.body;
  const userId = req.user.userId;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create conversation
      const [result] = await connection.execute(
        "INSERT INTO conversations (is_group) VALUES (?)",
        [participantIds.length > 1]
      );
      const conversationId = result.insertId;

      // Add all participants including the creator
      const allParticipants = [...new Set([userId, ...participantIds])];
      await Promise.all(
        allParticipants.map((participantId) =>
          connection.execute(
            "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)",
            [conversationId, participantId]
          )
        )
      );

      await connection.commit();
      res.json({ conversationId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Send a message
app.post("/api/messages", authenticateToken, async (req, res) => {
  const { conversationId, content } = req.body;
  const userId = req.user.userId;

  try {
    // Verify user is part of the conversation
    const [participants] = await pool.execute(
      "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
      [conversationId, userId]
    );

    if (participants.length === 0) {
      return res
        .status(403)
        .json({ message: "Not a member of this conversation" });
    }

    // Insert message
    const [result] = await pool.execute(
      "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
      [conversationId, userId, content]
    );

    // Update conversation timestamp
    await pool.execute(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [conversationId]
    );

    res.json({
      messageId: result.insertId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Get conversations for a user
app.get("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
            SELECT 
                c.id, 
                c.is_group,
                c.updated_at,
                GROUP_CONCAT(u.username) as participants
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            JOIN users u ON cp.user_id = u.id
            WHERE c.id IN (
                SELECT conversation_id 
                FROM conversation_participants 
                WHERE user_id = ?
            )
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        `,
      [req.user.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

app.get(
  "/api/conversations/:conversationId/messages",
  authenticateToken,
  async (req, res) => {
    const conversationId = parseInt(req.params.conversationId);
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    try {
      const [participants] = await pool.execute(
        "SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [conversationId, userId]
      );

      if (participants.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [messages] = await pool.execute(
        `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, 
          u.username as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
        [conversationId]
      );

      messages.reverse();
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);


app.post("/api/contacts/request", authenticateToken, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.userId;

  try {
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUserId = users[0].id;

    if (targetUserId === userId) {
      return res
        .status(400)
        .json({ message: "Cannot add yourself as contact" });
    }

    const [existing] = await pool.execute(
      "SELECT id FROM contacts WHERE (user_id = ? AND contact_id = ?) OR (user_id = ? AND contact_id = ?)",
      [userId, targetUserId, targetUserId, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Already in contacts" });
    }

    const [pending] = await pool.execute(
      "SELECT id FROM pending_contacts WHERE user_id = ? AND contact_id = ?",
      [userId, targetUserId]
    );

    if (pending.length > 0) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    await pool.execute(
      "INSERT INTO pending_contacts (user_id, contact_id) VALUES (?, ?)",
      [userId, targetUserId]
    );

     const targetSocket = userSockets.get(targetUserId);
     if (targetSocket) {
       targetSocket.emit("new_friend_request");
     }

     io.emit("friend_request_sent", {
       senderId: userId,
       receiverId: targetUserId,
       username: username,
     });

    res.json({ message: "Friend request sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send friend request" });
  }
});


app.get("/api/contacts/requests", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        u.id, 
        u.username, 
        p.created_at
       FROM pending_contacts p
       JOIN users u ON p.user_id = u.id
       WHERE p.contact_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch friend requests" });
  }
});




app.post("/api/contacts/accept", authenticateToken, async (req, res) => {
  const { userId: requesterId } = req.body;
  const accepterId = req.user.userId;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [pending] = await connection.execute(
      "SELECT id FROM pending_contacts WHERE user_id = ? AND contact_id = ?",
      [requesterId, accepterId]
    );

    if (pending.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Friend request not found" });
    }

    await connection.execute(
      "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?), (?, ?)",
      [requesterId, accepterId, accepterId, requesterId]
    );

    await connection.execute(
      "DELETE FROM pending_contacts WHERE user_id = ? AND contact_id = ?",
      [requesterId, accepterId]
    );

    await connection.commit();

    io.emit("contact_list_updated");
    res.json({ message: "Friend request accepted" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to accept friend request" });
  } finally {
    connection.release();
  }
});

// Reject friend request
app.post("/api/contacts/reject", authenticateToken, async (req, res) => {
  const { userId: requesterId } = req.body;
  const rejecterId = req.user.userId;

  try {
    await pool.execute(
      "DELETE FROM pending_contacts WHERE user_id = ? AND contact_id = ?",
      [requesterId, rejecterId]
    );

    res.json({ message: "Friend request rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reject friend request" });
  }
});



app.post("/api/avatar", authenticateToken, async (req, res) => {
  const { imageData } = req.body;
  const userId = req.user.userId;

  try {
    if (!imageData || !imageData.startsWith("data:image/")) {
      return res.status(400).json({ message: "Invalid image data" });
    }

    const base64Data = imageData.split(";base64,").pop();
    const imageBuffer = Buffer.from(base64Data, "base64");

    const processedImage = await sharp(imageBuffer)
      .resize(256, 256, {
        fit: "cover",
        position: "center",
      })
      .png()
      .toBuffer();

    await pool.execute("UPDATE users SET avatar_data = ? WHERE id = ?", [
      processedImage,
      userId,
    ]);
    io.emit("avatar_changed", userId);

    res.json({ message: "Avatar updated successfully" });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({ message: "Failed to upload avatar" });
  }
});

app.get('/api/avatar/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.execute(
      'SELECT avatar_data FROM users WHERE id =?',
      [userId]
    );

    if( rows.length === 0 || !rows[0].avatar_data) {
      return res.status(404).send();
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(rows[0].avatar_data);
  } catch (error) {
    console.error('Avatar fetch error:', error);
    res.status(500).json({message: 'Failed to fetch avatar'});
  }
})


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




