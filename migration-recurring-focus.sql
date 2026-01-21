-- Migration: Add recurrence and is_focused columns to tasks table
-- Run this in the Neon database console

-- Add recurrence column for recurring tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;

-- Add is_focused column for focus mode
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focused BOOLEAN DEFAULT false;
