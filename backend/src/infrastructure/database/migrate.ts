import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

export async function runMigrations() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || "petuser";
  const password = process.env.DB_PASSWORD || "petpass";
  const database = process.env.DB_NAME || "pet_tracker_db";

  console.log(`[Database] Verificando e criando banco se necessário em ${host}:${port}...`);

  // Conecta primeiro sem selecionar banco para criar o schema se não existir
  const rootConn = await mysql.createConnection({ host, port, user, password });
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await rootConn.end();

  const conn = await mysql.createConnection({ host, port, user, password, database });

  console.log(`[Database] Aplicando DDL das tabelas...`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`pets\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`nome\` VARCHAR(255) NOT NULL,
      \`raca\` VARCHAR(255) NULL,
      \`data_nascimento\` DATE NULL,
      \`status\` TINYINT(1) NOT NULL DEFAULT 1,
      \`path_foto\` VARCHAR(500) NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`sticks\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`stick_ref\` VARCHAR(100) NOT NULL UNIQUE,
      \`status\` TINYINT(1) NOT NULL DEFAULT 1,
      \`bateria\` DECIMAL(5,2) NULL,
      \`is_online\` TINYINT(1) NOT NULL DEFAULT 0,
      \`last_seen\` TIMESTAMP NULL,
      \`wifi_ssid\` VARCHAR(255) NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`trackers\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`tracker_ref\` VARCHAR(100) NOT NULL UNIQUE,
      \`status\` TINYINT(1) NOT NULL DEFAULT 1,
      \`bateria\` DECIMAL(5,2) NULL,
      \`is_online\` TINYINT(1) NOT NULL DEFAULT 0,
      \`last_seen\` TIMESTAMP NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`pet_trackers\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`pet_id\` INT NOT NULL,
      \`tracker_id\` INT NOT NULL,
      \`data_inicio\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`data_fim\` TIMESTAMP NULL,
      INDEX \`idx_pet\` (\`pet_id\`),
      INDEX \`idx_tracker\` (\`tracker_id\`),
      CONSTRAINT \`fk_pet_trackers_pet\` FOREIGN KEY (\`pet_id\`) REFERENCES \`pets\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_pet_trackers_tracker\` FOREIGN KEY (\`tracker_id\`) REFERENCES \`trackers\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`rastreios\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`tracker_id\` INT NOT NULL,
      \`pet_id\` INT NOT NULL,
      \`stick_id\` INT NULL,
      \`lat\` DECIMAL(10,8) NOT NULL,
      \`long\` DECIMAL(11,8) NOT NULL,
      \`rssi\` DECIMAL(6,2) NULL,
      \`bateria_stick\` DECIMAL(5,2) NULL,
      \`bateria_tracker\` DECIMAL(5,2) NULL,
      \`captured_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_rastreios_pet\` (\`pet_id\`),
      INDEX \`idx_rastreios_tracker\` (\`tracker_id\`),
      INDEX \`idx_rastreios_captured\` (\`captured_at\`),
      CONSTRAINT \`fk_rastreios_tracker\` FOREIGN KEY (\`tracker_id\`) REFERENCES \`trackers\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_rastreios_pet\` FOREIGN KEY (\`pet_id\`) REFERENCES \`pets\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_rastreios_stick\` FOREIGN KEY (\`stick_id\`) REFERENCES \`sticks\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`device_events\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`device_type\` VARCHAR(50) NOT NULL,
      \`device_ref\` VARCHAR(100) NOT NULL,
      \`event_type\` VARCHAR(50) NOT NULL,
      \`topic\` VARCHAR(255) NOT NULL,
      \`payload\` TEXT NOT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_events_device\` (\`device_ref\`),
      INDEX \`idx_events_created\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.end();
  console.log(`[Database] Migrations concluídas com sucesso!`);
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Database] Erro ao rodar migrations:", err);
      process.exit(1);
    });
}
