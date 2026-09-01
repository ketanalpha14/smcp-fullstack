require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const JWT_SECRET =
  process.env.JWT_SECRET || "change-me-in-production";

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "12mb"
}));

const PLATFORMS = [
  "Instagram",
  "Facebook",
  "Twitter / X",
  "LinkedIn"
];

const TYPES = [
  "Awareness",
  "Educational",
  "Event",
  "Fundraising",
  "Community Update"
];

const STATUSES = [
  "Planned",
  "Published",
  "Draft",
  "Scheduled"
];


/* =========================
   MONGODB CONNECTION
========================= */

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing");
  }

  if (mongoose.connection.readyState === 1) {
    cachedConnection = mongoose.connection;
    return cachedConnection;
  }

  cachedConnection = await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log("MongoDB connected");

  return cachedConnection;
}


/* =========================
   DATABASE SCHEMAS
========================= */

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },

    registeredAt: {
      type: Date,
      default: Date.now
    },

    lastLogin: {
      type: Date,
      default: null
    },

    org: {
      type: String,
      default: ""
    },

    phone: {
      type: String,
      default: ""
    },

    about: {
      type: String,
      default: ""
    },

    logo: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);


const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    platform: {
      type: String,
      enum: PLATFORMS,
      required: true
    },

    type: {
      type: String,
      enum: TYPES,
      required: true
    },

    status: {
      type: String,
      enum: STATUSES,
      required: true
    },

    date: {
      type: String,
      required: true
    },

    time: {
      type: String,
      default: ""
    },

    content: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: null
    },

    likes: {
      type: Number,
      default: 0
    },

    comments: {
      type: Number,
      default: 0
    },

    shares: {
      type: Number,
      default: 0
    },

    reach: {
      type: Number,
      default: 0
    },

    owner: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);


/* =========================
   MODELS
========================= */

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

const Post =
  mongoose.models.Post ||
  mongoose.model("Post", postSchema);


/* =========================
   ADMIN CREATION
========================= */

async function ensureAdmin() {

  const adminUser =
    process.env.ADMIN_USERNAME || "admin";

  const adminPass =
    process.env.ADMIN_PASSWORD;

  const adminEmail =
    process.env.ADMIN_EMAIL ||
    "admin@example.com";

  const existingAdmin =
    await User.findOne({
      username: adminUser
    });

  if (!existingAdmin && adminPass) {

    const passwordHash =
      await bcrypt.hash(adminPass, 12);

    await User.create({
      username: adminUser,
      name: "Administrator",
      email: adminEmail,
      passwordHash,
      role: "admin"
    });

    console.log(
      "Admin user created: " + adminUser
    );
  }
}


/* =========================
   AUTH MIDDLEWARE
========================= */

function auth(req, res, next) {

  const header =
    req.headers.authorization || "";

  const token =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

  if (!token) {

    return res.status(401).json({
      message: "Authentication required."
    });

  }

  try {

    req.user =
      jwt.verify(token, JWT_SECRET);

    next();

  } catch (error) {

    return res.status(401).json({
      message:
        "Invalid or expired session."
    });

  }
}


function adminOnly(req, res, next) {

  if (req.user.role !== "admin") {

    return res.status(403).json({
      message: "Admin access required."
    });

  }

  next();
}


/* =========================
   HELPER FUNCTIONS
========================= */

function signUser(user) {

  return jwt.sign(
    {
      id: String(user._id),
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );

}


function publicUser(user) {

  return {
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    registeredAt: user.registeredAt,
    lastLogin: user.lastLogin
  };

}


function engagement() {

  const likes =
    Math.floor(Math.random() * 450) + 50;

  return {

    likes,

    comments:
      Math.floor(
        likes *
        (0.05 + Math.random() * 0.12)
      ),

    shares:
      Math.floor(
        likes *
        (0.03 + Math.random() * 0.09)
      ),

    reach:
      Math.floor(
        likes *
        (4 + Math.random() * 7)
      )

  };

}


/* =========================
   DATABASE MIDDLEWARE
========================= */

app.use(async (req, res, next) => {

  try {

    await connectDB();
    await ensureAdmin();

    next();

  } catch (error) {

    console.error(
      "Database connection error:",
      error
    );

    res.status(500).json({
      message:
        "Database connection failed."
    });

  }

});


/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      message:
        "Backend is working!"
    });

  }
);


/* =========================
   REGISTER
========================= */

app.post(
  "/api/auth/register",

  async (req, res) => {

    try {

      const {
        name,
        username,
        email,
        password,
        org = ""
      } = req.body;

      if (
        !name ||
        !username ||
        !email ||
        !password
      ) {

        return res
          .status(400)
          .json({
            message:
              "Please fill in all fields."
          });

      }

      if (password.length < 6) {

        return res
          .status(400)
          .json({
            message:
              "Password must be at least 6 characters."
          });

      }

      const existingUser =
        await User.findOne({
          username
        });

      if (existingUser) {

        return res
          .status(409)
          .json({
            message:
              "Username already exists."
          });

      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user =
        await User.create({

          name,

          username,

          email,

          passwordHash,

          role: "user",

          org,

          lastLogin:
            new Date()

        });

      res.status(201).json({

        token:
          signUser(user),

        user:
          publicUser(user)

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          "Registration failed."
      });

    }

  }
);


/* =========================
   LOGIN
========================= */

app.post(
  "/api/auth/login",

  async (req, res) => {

    try {

      const {
        username,
        password
      } = req.body;

      const user =
        await User.findOne({
          username
        });

      if (
        !user ||
        !(
          await bcrypt.compare(
            password,
            user.passwordHash
          )
        )
      ) {

        return res
          .status(401)
          .json({
            message:
              "Invalid username or password."
          });

      }

      user.lastLogin =
        new Date();

      await user.save();

      res.json({

        token:
          signUser(user),

        user:
          publicUser(user)

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          "Login failed."
      });

    }

  }
);


/* =========================
   FORGOT PASSWORD
========================= */

app.post(
  "/api/auth/forgot",

  async (req, res) => {

    res.json({

      message:
        "If the email exists in our system, reset instructions would be sent."

    });

  }
);


/* =========================
   GET POSTS
========================= */

app.get(
  "/api/posts",

  auth,

  async (req, res) => {

    try {

      const query =
        req.user.role === "admin"
          ? {}
          : {
              owner:
                req.user.username
            };

      const posts =
        await Post.find(query)
          .sort({
            date: 1,
            time: 1,
            createdAt: 1
          })
          .lean();

      res.json(posts);

    } catch (error) {

      res.status(500).json({
        message:
          "Could not load posts."
      });

    }

  }
);


/* =========================
   CREATE POST
========================= */

app.post(
  "/api/posts",

  auth,

  async (req, res) => {

    try {

      const {

        title,
        platform,
        type,
        status,
        date,

        time = "",

        content = "",

        image = null

      } = req.body;

      if (!title || !date) {

        return res
          .status(400)
          .json({

            message:
              "Please enter a post title and date."

          });

      }

      if (

        !PLATFORMS.includes(
          platform
        ) ||

        !TYPES.includes(
          type
        ) ||

        !STATUSES.includes(
          status
        )

      ) {

        return res
          .status(400)
          .json({

            message:
              "Invalid post options."

          });

      }

      if (
        date <
        new Date()
          .toISOString()
          .slice(0, 10)
      ) {

        return res
          .status(400)
          .json({

            message:
              "Previous dates are not allowed for a new post."

          });

      }

      const post =
        await Post.create({

          title,

          platform,

          type,

          status,

          date,

          time,

          content,

          image,

          owner:
            req.user.username,

          ...(status === "Published"
            ? engagement()
            : {})

        });

      res
        .status(201)
        .json(post);

    } catch (error) {

      console.error(error);

      res.status(500).json({

        message:
          "Could not create post."

      });

    }

  }
);


/* =========================
   UPDATE POST
========================= */

app.put(
  "/api/posts/:id",

  auth,

  async (req, res) => {

    try {

      const post =
        await Post.findById(
          req.params.id
        );

      if (!post) {

        return res
          .status(404)
          .json({

            message:
              "Post not found."

          });

      }

      if (

        req.user.role !== "admin" &&

        post.owner !==
          req.user.username

      ) {

        return res
          .status(403)
          .json({

            message:
              "You can only edit your own posts."

          });

      }

      const allowed = [

        "title",

        "platform",

        "type",

        "status",

        "date",

        "time",

        "content",

        "image"

      ];

      allowed.forEach(
        key => {

          if (
            req.body[key] !==
            undefined
          ) {

            post[key] =
              req.body[key];

          }

        }
      );

      if (

        post.status ===
          "Published" &&

        !post.likes &&

        !post.comments &&

        !post.shares &&

        !post.reach

      ) {

        Object.assign(
          post,
          engagement()
        );

      }

      await post.save();

      res.json(post);

    } catch (error) {

      console.error(error);

      res.status(500).json({

        message:
          "Could not update post."

      });

    }

  }
);


/* =========================
   DELETE POST
========================= */

app.delete(
  "/api/posts/:id",

  auth,

  async (req, res) => {

    try {

      const post =
        await Post.findById(
          req.params.id
        );

      if (!post) {

        return res
          .status(404)
          .json({

            message:
              "Post not found."

          });

      }

      if (

        req.user.role !== "admin" &&

        post.owner !==
          req.user.username

      ) {

        return res
          .status(403)
          .json({

            message:
              "You can only delete your own posts."

          });

      }

      await post.deleteOne();

      res.json({
        ok: true
      });

    } catch (error) {

      res.status(500).json({

        message:
          "Could not delete post."

      });

    }

  }
);


/* =========================
   GET PROFILE
========================= */

app.get(
  "/api/profile",

  auth,

  async (req, res) => {

    try {

      const user =
        await User.findOne({

          username:
            req.user.username

        });

      res.json({

        name:
          user.name,

        email:
          user.email,

        org:
          user.org,

        phone:
          user.phone,

        about:
          user.about,

        logo:
          user.logo

      });

    } catch (error) {

      res.status(500).json({

        message:
          "Could not load profile."

      });

    }

  }
);


/* =========================
   UPDATE PROFILE
========================= */

app.put(
  "/api/profile",

  auth,

  async (req, res) => {

    try {

      const user =
        await User.findOne({

          username:
            req.user.username

        });

      Object.assign(
        user,
        {

          name:
            req.body.name,

          email:
            req.body.email,

          org:
            req.body.org,

          phone:
            req.body.phone,

          about:
            req.body.about,

          logo:
            req.body.logo || null

        }
      );

      await user.save();

      res.json({

        ok: true,

        profile: {

          name:
            user.name,

          email:
            user.email,

          org:
            user.org,

          phone:
            user.phone,

          about:
            user.about,

          logo:
            user.logo

        }

      });

    } catch (error) {

      res.status(500).json({

        message:
          "Could not save profile."

      });

    }

  }
);


/* =========================
   ADMIN USERS
========================= */

app.get(
  "/api/users",

  auth,

  adminOnly,

  async (req, res) => {

    try {

      const users =
        await User.find({})
          .sort({
            registeredAt: 1
          })
          .lean();

      res.json(
        users.map(
          publicUser
        )
      );

    } catch (error) {

      res.status(500).json({

        message:
          "Could not load users."

      });

    }

  }
);


/* =========================
   DELETE USER
========================= */

app.delete(
  "/api/users/:username",

  auth,

  adminOnly,

  async (req, res) => {

    try {

      if (

        req.params.username ===
        req.user.username

      ) {

        return res
          .status(400)
          .json({

            message:
              "You can't delete the account you're logged in as."

          });

      }

      const user =
        await User.findOneAndDelete({

          username:
            req.params.username

        });

      if (!user) {

        return res
          .status(404)
          .json({

            message:
              "User not found."

          });

      }

      await Post.deleteMany({

        owner:
          req.params.username

      });

      res.json({
        ok: true
      });

    } catch (error) {

      res.status(500).json({

        message:
          "Could not delete account."

      });

    }

  }
);


/* =========================
   VERCEL EXPORT
========================= */

module.exports = app;
