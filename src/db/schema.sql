-- Africa University Portfolio & Recommendation System Schema

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role VARCHAR(32) NOT NULL, -- 'student', 'staff', 'supervisor', 'admin'
  name VARCHAR(255) NOT NULL,
  school_id VARCHAR(64) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'pending', 'correction', 'rejected', 'deactivated'
  year INT,
  programme VARCHAR(255),
  overall NUMERIC(4,2),
  gpas JSONB DEFAULT '[]'::jsonb,
  bio TEXT DEFAULT '',
  skills JSONB DEFAULT '[]'::jsonb,
  linkedin TEXT DEFAULT '',
  github TEXT DEFAULT '',
  photo TEXT,
  hon VARCHAR(32),
  title VARCHAR(64),
  dept VARCHAR(128),
  teaches JSONB DEFAULT '[]'::jsonb,
  company VARCHAR(255),
  attach JSONB,
  signup_info JSONB,
  must_change_password BOOLEAN DEFAULT false,
  public_share JSONB DEFAULT '{"enabled": false, "showGrades": true, "showTranscripts": false, "showProjects": true, "showActs": true, "showLetters": false}'::jsonb,
  share_slug VARCHAR(128) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS registry (
  school_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  year INT NOT NULL,
  programme VARCHAR(255) NOT NULL,
  overall NUMERIC(4,2),
  gpas JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  stage VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email);

CREATE TABLE IF NOT EXISTS portfolio_state (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'current',
  version INT DEFAULT 2,
  projects JSONB DEFAULT '[]'::jsonb,
  acts JSONB DEFAULT '[]'::jsonb,
  letters JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  finals JSONB DEFAULT '{}'::jsonb,
  assess JSONB DEFAULT '[]'::jsonb,
  perms JSONB NOT NULL,
  perm_log JSONB DEFAULT '[]'::jsonb,
  audit_log JSONB DEFAULT '[]'::jsonb,
  reports JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_recommendation_history (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  staff_id VARCHAR(64),
  prompt_type VARCHAR(64) NOT NULL, -- 'letter', 'portfolio_review', 'project_polish'
  generated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guest_access (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  access_code VARCHAR(10) NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'letter' or 'verify'
  reference_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_access_token ON guest_access(token);
CREATE INDEX IF NOT EXISTS idx_guest_access_code ON guest_access(access_code);

