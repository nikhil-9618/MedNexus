const { wrapAll } = require('../utils/asyncHandler');
/** Assistant controller — wraps the deterministic/optional-AI service. */
const assistantService = require('../services/assistant.service');

/** POST /api/assistant */
async function ask(req, res) {
  const message = String(req.body.message || '').slice(0, 500);
  const answer = await assistantService.ask(message);
  res.json({ success: true, ...answer });
}

/** GET /api/assistant/meta — disclaimer + suggested questions for the UI. */
async function meta(_req, res) {
  res.json({
    success: true,
    disclaimer: assistantService.DISCLAIMER,
    suggestions: [
      'How do I book an appointment?',
      'How do I cancel my appointment?',
      'Where can I see my previous appointments?',
      'Where do I find my medical records?',
      'What does the appointment status mean?',
      'Is my data real?',
    ],
  });
}

module.exports = { ask, meta };

wrapAll(module.exports);
