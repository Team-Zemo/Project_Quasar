const Persona = require('../models/Persona');
const logger = require('../utils/logger');

/**
 * GET /api/personas
 * Returns all available interview personas
 */
async function getPersonas(req, res) {
  try {
    const personas = await Persona.find()
      .select('_id name description interruptionStyle followUpAggression')
      .sort({ followUpAggression: 1 })
      .lean();

    // Map to match frontend expectations (snake_case)
    const result = personas.map(p => ({
      id: p._id,
      name: p.name,
      description: p.description,
      interruption_style: p.interruptionStyle,
      follow_up_aggression: p.followUpAggression,
    }));

    return res.json({
      success: true,
      message: 'Personas retrieved',
      data: result
    });
  } catch (err) {
    logger.error('Get personas error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get personas', data: null });
  }
}

/**
 * GET /api/personas/:id
 * Returns a single persona with full system prompt
 */
async function getPersona(req, res) {
  try {
    const { id } = req.params;

    const persona = await Persona.findById(id).lean();

    if (!persona) {
      return res.status(404).json({ success: false, message: 'Persona not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Persona retrieved',
      data: {
        id: persona._id,
        name: persona.name,
        description: persona.description,
        system_prompt: persona.systemPrompt,
        interruption_style: persona.interruptionStyle,
        follow_up_aggression: persona.followUpAggression,
      }
    });
  } catch (err) {
    logger.error('Get persona error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get persona', data: null });
  }
}

module.exports = { getPersonas, getPersona };
