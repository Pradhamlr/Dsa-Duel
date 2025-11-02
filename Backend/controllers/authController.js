import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';

export const register = async (req, res) => {
  try {
    const { email, username, password, name } = req.body;
    
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await withPrisma(async (prisma) => {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email || undefined },
            { username: username || undefined }
          ]
        }
      }).catch((error) => {
        console.error('Database error while checking existing user:', error);
        throw new Error('Database connection failed');
      });
      
      if (existingUser) {
        return { error: 'User already exists', status: 400 };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData = {
        id: randomUUID(),
        name: name || username || email?.split('@')[0]
      };
      
      try {
        userData.email = email;
        userData.username = username;
        userData.password = hashedPassword;
      } catch (e) {
        console.log('Using legacy user schema');
      }
      
      const user = await prisma.user.create({ data: userData });

      const token = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name
        }
      };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username required' });
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email || undefined },
            { username: username || undefined }
          ]
        }
      }).catch(() => null);
      
      if (!user || !user.password) {
        return { error: 'Invalid credentials', status: 401 };
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return { error: 'Invalid credentials', status: 401 };
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });
      } catch (e) {
        console.log('lastLogin field not available');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name
        }
      };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          createdAt: true,
          lastLogin: true
        }
      });
      
      if (!user) {
        return { error: 'User not found', status: 404 };
      }
      
      return { user };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};