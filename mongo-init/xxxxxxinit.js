db.createUser({
  user: "emergent_user",
  pwd: "emergent_pass",
  roles: [
    {
      role: "readWrite",
      db: "emergent",
    },
  ],
});
db.risk_settings.updateOne(
  { id: "default" },
  {
    $setOnInsert: {
      id: "default",
      formula: "likelihood * impact",
      residual_formula: "likelihood * impact * (1 - controls_effectiveness)",
      max_scale: 25,
      thresholds: { low: 5, medium: 12, high: 20, critical: 25 },
      matrix: [
        ["low", "low", "medium", "medium", "high"],
        ["low", "medium", "medium", "high", "high"],
        ["medium", "medium", "high", "high", "critical"],
        ["medium", "high", "high", "critical", "critical"],
        ["high", "high", "critical", "critical", "critical"],
      ],
      palette: {
        low: "#90EE90",
        medium: "#F9E076",
        high: "#F39C12",
        critical: "#E74C3C",
      },
      updated_at: new Date(),
    },
  },
  { upsert: true }
);

db.risk_report_templates.updateOne(
  { id: "default" },
  {
    $setOnInsert: {
      id: "default",
      name: "Risk Executive Summary",
      description: "Default risk report template",
      body:
        "<h1>{{title}}</h1><p>Status: {{status}}</p><p>Inherent Score: {{inherent_score}}</p><p>Residual Score: {{residual_score}}</p><p>Owner: {{owner}}</p><p>Controls: {{controls}}</p>",
      created_at: new Date(),
      updated_at: new Date(),
    },
  },
  { upsert: true }
);
