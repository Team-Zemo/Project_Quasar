const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/personas
 * Returns all available interview personas
 */
async function getPersonas(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, description, interruption_style, follow_up_aggression FROM personas ORDER BY follow_up_aggression ASC'
    );

    return res.json({
      success: true,
      message: 'Personas retrieved',
      data: result.rows
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

    const result = await pool.query(
      'SELECT * FROM personas WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Persona not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Persona retrieved',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('Get persona error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get persona', data: null });
  }
}

module.exports = { getPersonas, getPersona };
