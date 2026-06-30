-- 数据源管理 D1 数据库初始化 SQL
-- 运行方式: wrangler d1 execute <database-name> --file=./datasource.sql

CREATE TABLE IF NOT EXISTS data_sources (
    id           TEXT PRIMARY KEY,
    file_name    TEXT NOT NULL,
    file_size    INTEGER NOT NULL,
    record_count INTEGER NOT NULL,
    field_names  TEXT NOT NULL,
    r2_key       TEXT NOT NULL,
    r2_excel_key TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
