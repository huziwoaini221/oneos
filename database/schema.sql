-- LifeHub D1 schema
-- 7 张表：settings / tasks / events / contacts / expenses / reminder_rules / reminder_logs
-- 所有时间统一 UTC 存储（ISO 8601），展示时按 settings.timezone 转换

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  timezone TEXT DEFAULT 'Asia/Shanghai',
  telegram_chat_id TEXT,
  telegram_enabled INTEGER DEFAULT 1,
  default_channel TEXT DEFAULT 'telegram',
  weather_city TEXT
);

INSERT INTO settings(id) VALUES(1);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  deadline DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  location TEXT,
  notes TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  country TEXT,
  industry TEXT,
  phone TEXT,
  email TEXT,
  wechat TEXT,
  telegram TEXT,
  level TEXT DEFAULT 'normal',
  last_contact DATE,
  next_followup DATE,
  address TEXT,
  birthday TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL,
  category TEXT,
  date DATE,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reminder_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT,
  condition_json TEXT,
  schedule TEXT,
  next_fire_at DATETIME,
  channel TEXT DEFAULT 'telegram',
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reminder_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER,
  object_type TEXT,
  object_id INTEGER,
  status TEXT,
  trigger_time DATETIME,
  sent_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminder_lookup
ON reminder_logs(rule_id, object_type, object_id, sent_time);

-- 内置提醒模板种子
-- 1. 每日晨报（time 型；next_fire_at 首次运行时初始化）
INSERT INTO reminder_rules(name, type, schedule, next_fire_at)
VALUES('每日晨报', 'time', '0 8 * * *', NULL);

-- 2. 日程提前 30 分钟（data 型 events）
INSERT INTO reminder_rules(name, type, source, condition_json)
VALUES('日程提醒', 'data', 'events', '{"type":"before","minutes":30}');

-- 3. 联系人维护（data 型 contacts；30 天未联系，notify_interval = 30 天）
INSERT INTO reminder_rules(name, type, source, condition_json)
VALUES('联系人维护', 'data', 'contacts', '{"type":"days_since","field":"last_contact","value":30,"notify_interval":2592000}');

-- 4. 生日提醒（data 型 birthdays；每天检查一次，notify_interval = 1 天）
INSERT INTO reminder_rules(name, type, source, condition_json)
VALUES('生日提醒', 'data', 'birthdays', '{"type":"birthday","notify_interval":86400}');

-- 4. 财务检查（Sprint 8 启用）
-- INSERT INTO reminder_rules(name, type, source, condition_json)
-- VALUES('财务检查', 'data', 'finance', '{"type":"over_budget","category":"food","amount":2000,"period":"monthly","notify_interval":2592000}');
