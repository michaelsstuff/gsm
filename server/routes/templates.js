const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const { requireAdmin } = require('../utils/authMiddleware');

const templatesRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(templatesRouteLimiter);

// Templates directory
const TEMPLATES_DIR = path.join(__dirname, '../templates');

// Template metadata
const TEMPLATE_METADATA = {
  'minecraft-java': {
    name: 'Minecraft Java Edition',
    description: 'Vanilla or modded Minecraft server using itzg/minecraft-server',
    image: 'itzg/minecraft-server',
    ports: ['25565'],
    minMemory: '2GB',
    documentation: 'https://docker-minecraft-server.readthedocs.io/'
  },
  'minecraft-bedrock': {
    name: 'Minecraft Bedrock Edition',
    description: 'Bedrock Edition server for cross-platform play',
    image: 'itzg/minecraft-bedrock-server',
    ports: ['19132/udp'],
    minMemory: '1GB',
    documentation: 'https://github.com/itzg/docker-minecraft-bedrock-server'
  },
  'valheim': {
    name: 'Valheim',
    description: 'Viking survival game dedicated server',
    image: 'lloesche/valheim-server',
    ports: ['2456-2458/udp'],
    minMemory: '4GB',
    documentation: 'https://github.com/lloesche/valheim-server-docker'
  },
  'terraria': {
    name: 'Terraria',
    description: '2D sandbox adventure game server',
    image: 'ryshe/terraria',
    ports: ['7777'],
    minMemory: '1GB',
    documentation: 'https://github.com/ryansheehan/terraria'
  },
  'satisfactory': {
    name: 'Satisfactory',
    description: 'Factory building game dedicated server',
    image: 'wolveix/satisfactory-server',
    ports: ['7777/udp', '7777/tcp'],
    minMemory: '8GB',
    documentation: 'https://github.com/wolveix/satisfactory-server'
  },
  'palworld': {
    name: 'Palworld',
    description: 'Creature collection survival game server',
    image: 'thijsvanloef/palworld-server-docker',
    ports: ['8211/udp', '27015/udp'],
    minMemory: '16GB',
    documentation: 'https://github.com/thijsvanloef/palworld-server-docker'
  },
  '7daystodie': {
    name: '7 Days to Die',
    description: 'Zombie survival game dedicated server',
    image: 'vinanrra/7dtd-server',
    ports: ['26900/tcp', '26900-26902/udp', '8081/tcp'],
    minMemory: '8GB',
    documentation: 'https://github.com/vinanrra/Docker-7DaysToDie'
  },
  'factorio': {
    name: 'Factorio',
    description: 'Factory building game dedicated server',
    image: 'factoriotools/factorio',
    ports: ['34197/udp', '27015/tcp'],
    minMemory: '2GB',
    documentation: 'https://github.com/factoriotools/factorio-docker'
  }
};

// @route   GET /api/admin/templates
// @desc    Get all available templates
// @access  Admin only
router.get('/', requireAdmin, async (req, res) => {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates = [];
    
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const templateName = file.replace(/\.ya?ml$/, '');
        const metadata = TEMPLATE_METADATA[templateName] || {
          name: templateName,
          description: 'Custom template'
        };
        
        templates.push({
          id: templateName,
          filename: file,
          ...metadata
        });
      }
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/templates/:name
// @desc    Get a specific template content
// @access  Admin only
router.get('/:name', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Security: prevent directory traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ message: 'Invalid template name' });
    }
    
    // Try both .yml and .yaml extensions
    let content;
    let filename;
    
    for (const ext of ['.yml', '.yaml']) {
      try {
        filename = `${name}${ext}`;
        const filePath = path.join(TEMPLATES_DIR, filename);
        content = await fs.readFile(filePath, 'utf8');
        break;
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    
    if (!content) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    const metadata = TEMPLATE_METADATA[name] || {
      name: name,
      description: 'Custom template'
    };
    
    res.json({
      id: name,
      filename,
      content,
      ...metadata
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
