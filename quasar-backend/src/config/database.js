const { Pool } = require('pg');
const config = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.pgHost,
  port: config.pgPort,
  user: config.pgUser,
  password: config.pgPassword,
  database: config.pgDatabase,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { err });
});

/**
 * Initialize all database tables
 */
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        google_id VARCHAR(255) UNIQUE,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);

    // Interview sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        domain VARCHAR(255),
        persona_id VARCHAR(50),
        jd_session_id UUID,
        status VARCHAR(20) DEFAULT 'active',
        overall_score DECIMAL(3,1),
        star_scores JSONB,
        clarity_score DECIMAL(3,1),
        transcript TEXT,
        duration_seconds INTEGER,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        emotion_metrics JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);

    // Speech metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS speech_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        transcript TEXT,
        filler_buckets JSONB,
        total_fillers INTEGER DEFAULT 0,
        words_per_minute DECIMAL(5,1),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_speech_metrics_session ON speech_metrics(session_id);
    `);

    // Personas table
    await client.query(`
      CREATE TABLE IF NOT EXISTS personas (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        interruption_style VARCHAR(50),
        follow_up_aggression INTEGER DEFAULT 3,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // JD sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jd_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        job_description TEXT NOT NULL,
        parsed_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jd_sessions_user ON jd_sessions(user_id);
    `);

    // JD questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jd_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        jd_session_id UUID NOT NULL REFERENCES jd_sessions(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        category VARCHAR(50),
        difficulty INTEGER DEFAULT 1,
        target_skill VARCHAR(100),
        weight DECIMAL(3,2) DEFAULT 0.5,
        last_attempted_session UUID,
        last_score DECIMAL(3,1),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jd_questions_jd ON jd_questions(jd_session_id);
    `);

    // Skill vectors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill VARCHAR(100) NOT NULL,
        score DECIMAL(4,2) DEFAULT 5.0,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        attempt_count INTEGER DEFAULT 0,
        UNIQUE(user_id, skill)
      );
      CREATE INDEX IF NOT EXISTS idx_skill_vectors_user ON skill_vectors(user_id);
    `);

    // Seed personas
    await client.query(`
      INSERT INTO personas (id, name, description, system_prompt, interruption_style, follow_up_aggression)
      VALUES
        ('faang_engineer', 'FAANG Engineer',
         'A senior Staff Engineer at Google conducting a structured behavioural and system design interview. Professional, methodical, and technically exacting.',
         'You are a senior Staff Engineer at Google conducting a structured behavioural and system design interview. Ask one question at a time. Follow up with "Tell me more about X" or "How would you scale that?". Expect STAR-format answers. Be professional, methodical, and technically exacting. If the candidate is vague, press for specifics. Never accept the first answer — always probe one level deeper.',
         'minimal', 2),
        ('startup_founder', 'Aggressive Startup Founder',
         'A Series A startup founder conducting a high-pressure interview. Blunt, impatient, and direct. Challenges every claim.',
         'You are a Series A startup founder conducting a high-pressure interview. You have 20 minutes and zero tolerance for fluff. Interrupt if the candidate is rambling. Ask things like "Why should I hire you over someone with 5 more years?", "That sounds like something everyone says — what''s actually unique about you?", "We move fast — give me evidence you can too." Be blunt, impatient, and direct. Challenge every claim.',
         'frequent', 5),
        ('hr_manager', 'HR Manager',
         'An HR Manager focused on culture fit, values alignment, and soft skills. Warm but probing. Avoids technical questions entirely.',
         'You are an HR Manager focused on culture fit, values alignment, and soft skills. Ask about teamwork, conflict resolution, growth mindset, and how the candidate handles failure. Use open-ended questions. Be warm but probing. Follow up vague answers with "Can you walk me through a specific example?" Avoid technical questions entirely.',
         'none', 1),
        ('hostile_panel', 'Hostile Panel',
         'A panel of three interviewers with different perspectives. Creates mild pressure and contradictions. Makes the candidate work harder.',
         'You are a panel of three interviewers. One is technical and skeptical, one is focused on leadership, one is challenging every answer for consistency. Rotate perspectives in your responses. Create mild pressure and contradictions: "Our technical interviewer thinks your answer lacks depth, but our leadership interviewer liked the people angle — can you address both?" Make the candidate work harder to satisfy multiple viewpoints simultaneously.',
         'moderate', 4)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query('COMMIT');
    logger.info('Database tables initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize database tables', { err: err.message });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
