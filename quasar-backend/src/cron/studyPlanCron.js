/**
 * Study Plan Cron Job
 * Runs daily at 8:00 AM IST (2:30 AM UTC) and sends reminder emails
 * to all users with active study plans whose schedule includes today.
 */
const cron = require('node-cron');
const StudyPlan = require('../models/StudyPlan');
const User = require('../models/User');
const { sendStudyPlanReminder } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Process active study plans and send daily emails.
 * Called by the cron job but exported for testing.
 */
async function processStudyPlanEmails() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all active plans that haven't been emailed today
    const activePlans = await StudyPlan.find({
      status: 'active',
      $or: [
        { lastEmailSentDate: null },
        { lastEmailSentDate: { $lt: today } },
      ],
    }).lean();

    logger.info(`Study plan cron: found ${activePlans.length} active plans to check`);

    let emailsSent = 0;

    for (const plan of activePlans) {
      try {
        // Find today's schedule entry
        const todayEntry = plan.schedule.find(s => {
          const schedDate = new Date(s.date);
          schedDate.setHours(0, 0, 0, 0);
          return schedDate.getTime() === today.getTime();
        });

        if (!todayEntry) {
          // No entry for today — check if plan has ended
          const lastDate = plan.schedule.length > 0
            ? new Date(plan.schedule[plan.schedule.length - 1].date)
            : null;

          if (lastDate && lastDate < today) {
            // Plan is over, mark as completed
            await StudyPlan.updateOne({ _id: plan._id }, { status: 'completed' });
            logger.info('Study plan auto-completed (past end date)', { userId: plan.userId });
          }
          continue;
        }

        if (todayEntry.completed) {
          // Already marked as completed, skip email
          continue;
        }

        // Get user info for email
        const user = await User.findById(plan.userId).select('email name').lean();
        if (!user?.email) continue;

        // Calculate progress
        const totalDays = plan.schedule.length;
        const completedDays = plan.schedule.filter(s => s.completed).length;
        const currentDayIndex = plan.schedule.findIndex(s => {
          const d = new Date(s.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });
        const progressPct = Math.round((completedDays / totalDays) * 100);

        // Send the email
        await sendStudyPlanReminder(
          user.email,
          user.name || 'there',
          plan.skillToLearn,
          todayEntry,
          {
            week: todayEntry.week,
            dayIndex: currentDayIndex + 1,
            totalDays,
            completedDays,
            progressPct,
          }
        );

        // Update lastEmailSentDate
        await StudyPlan.updateOne(
          { _id: plan._id },
          { lastEmailSentDate: new Date() }
        );

        emailsSent++;
      } catch (planErr) {
        logger.error('Study plan cron: error processing plan', {
          planId: plan._id,
          userId: plan.userId,
          err: planErr.message,
        });
      }
    }

    logger.info(`Study plan cron completed: ${emailsSent} emails sent`);
  } catch (err) {
    logger.error('Study plan cron fatal error', { err: err.message });
  }
}

/**
 * Start the cron job.
 * Schedule: "30 2 * * *" = 2:30 AM UTC = 8:00 AM IST daily.
 */
function startStudyPlanCron() {
  cron.schedule('30 2 * * *', () => {
    logger.info('Study plan cron triggered (8:00 AM IST)');
    processStudyPlanEmails();
  }, {
    timezone: 'Asia/Kolkata',
  });

  logger.info('Study plan cron job registered — runs daily at 8:00 AM IST');
}

module.exports = { startStudyPlanCron, processStudyPlanEmails };
