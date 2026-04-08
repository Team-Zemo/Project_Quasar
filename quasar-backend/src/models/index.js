const User = require('./User');
const RefreshToken = require('./RefreshToken');
const Session = require('./Session');
const SpeechMetrics = require('./SpeechMetrics');
const Persona = require('./Persona');
const JdSession = require('./JdSession');
const JdQuestion = require('./JdQuestion');
const SkillVector = require('./SkillVector');
const UserStats = require('./UserStats');
const JobPosting = require('./JobPosting');
const McqQuestion = require('./McqQuestion');
const Application = require('./Application');
const logger = require('../utils/logger');

/**
 * Seed default personas if they don't exist
 */
async function seedPersonas() {
  const personas = [
    {
      _id: 'faang_engineer',
      name: 'FAANG Engineer',
      description: 'A senior Staff Engineer at Google conducting a structured behavioural and system design interview. Professional, methodical, and technically exacting.',
      systemPrompt: 'You are a senior Staff Engineer at Google conducting a structured behavioural and system design interview. Ask one question at a time. Follow up with "Tell me more about X" or "How would you scale that?". Expect STAR-format answers. Be professional, methodical, and technically exacting. If the candidate is vague, press for specifics. Never accept the first answer — always probe one level deeper.',
      interruptionStyle: 'minimal',
      followUpAggression: 2,
    },
    {
      _id: 'startup_founder',
      name: 'Aggressive Startup Founder',
      description: 'A Series A startup founder conducting a high-pressure interview. Blunt, impatient, and direct. Challenges every claim.',
      systemPrompt: 'You are a Series A startup founder conducting a high-pressure interview. You have 20 minutes and zero tolerance for fluff. Interrupt if the candidate is rambling. Ask things like "Why should I hire you over someone with 5 more years?", "That sounds like something everyone says — what\'s actually unique about you?", "We move fast — give me evidence you can too." Be blunt, impatient, and direct. Challenge every claim.',
      interruptionStyle: 'frequent',
      followUpAggression: 5,
    },
    {
      _id: 'hr_manager',
      name: 'HR Manager',
      description: 'An HR Manager focused on culture fit, values alignment, and soft skills. Warm but probing. Avoids technical questions entirely.',
      systemPrompt: 'You are an HR Manager focused on culture fit, values alignment, and soft skills. Ask about teamwork, conflict resolution, growth mindset, and how the candidate handles failure. Use open-ended questions. Be warm but probing. Follow up vague answers with "Can you walk me through a specific example?" Avoid technical questions entirely.',
      interruptionStyle: 'none',
      followUpAggression: 1,
    },
    {
      _id: 'hostile_panel',
      name: 'Hostile Panel',
      description: 'A panel of three interviewers with different perspectives. Creates mild pressure and contradictions. Makes the candidate work harder.',
      systemPrompt: 'You are a panel of three interviewers. One is technical and skeptical, one is focused on leadership, one is challenging every answer for consistency. Rotate perspectives in your responses. Create mild pressure and contradictions: "Our technical interviewer thinks your answer lacks depth, but our leadership interviewer liked the people angle — can you address both?" Make the candidate work harder to satisfy multiple viewpoints simultaneously.',
      interruptionStyle: 'moderate',
      followUpAggression: 4,
    },
  ];

  for (const persona of personas) {
    try {
      await Persona.findByIdAndUpdate(
        persona._id,
        persona,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // Ignore duplicate key errors during seed
      if (err.code !== 11000) {
        logger.warn(`Failed to seed persona ${persona._id}`, { err: err.message });
      }
    }
  }

  logger.info('Personas seeded successfully');
}

module.exports = {
  User,
  RefreshToken,
  Session,
  SpeechMetrics,
  Persona,
  JdSession,
  JdQuestion,
  SkillVector,
  UserStats,
  JobPosting,
  McqQuestion,
  Application,
  seedPersonas,
};
