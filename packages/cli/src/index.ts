#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { MatuMailer, detectSmtp } from 'matumailer';

function loadToken(): string {
  const token = process.env.MATUMAILER_TOKEN;
  if (!token) {
    console.error(
      chalk.red('\n  Falta MATUMAILER_TOKEN. Configúralo en tu .env o pásalo con --token.\n'),
    );
    process.exit(1);
  }
  return token;
}

function loadProjectId(): string {
  const id = process.env.MATUMAILER_PROJECT_ID;
  if (!id) {
    console.error(
      chalk.red('\n  Falta MATUMAILER_PROJECT_ID (UUID del proyecto). Configúralo en tu .env.\n'),
    );
    process.exit(1);
  }
  return id;
}

const program = new Command();

program
  .name('matumailer')
  .description('MatuMailer CLI — email infrastructure setup')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize MatuMailer in your project')
  .option('-d, --dir <path>', 'Target directory', '.')
  .action(async (opts: { dir: string }) => {
    const dir = opts.dir;
    console.log(chalk.cyan.bold('\n  MatuMailer Init\n'));

    const envContent = `# MatuMailer Configuration
MATUMAILER_TOKEN=mm_live_your_token_here
MATUMAILER_API_URL=http://localhost:4000

# Optional SMTP (for local testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
`;

    const envPath = join(dir, '.env.matumailer');
    if (!existsSync(envPath)) {
      writeFileSync(envPath, envContent);
      console.log(chalk.green(`  ✓ Created ${envPath}`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${envPath} already exists, skipped`));
    }

    const templatesDir = join(dir, 'matumailer-templates');
    if (!existsSync(templatesDir)) {
      mkdirSync(templatesDir, { recursive: true });

      writeFileSync(
        join(templatesDir, 'welcome.html'),
        `<h1>Welcome, {{name}}!</h1><p>Thanks for joining.</p>`,
      );
      writeFileSync(
        join(templatesDir, 'password-recovery.html'),
        `<h1>Reset Password</h1><p>Hi {{name}}, <a href="{{resetLink}}">click here</a>.</p>`,
      );
      writeFileSync(
        join(templatesDir, 'notification.html'),
        `<h2>{{title}}</h2><p>{{message}}</p>`,
      );
      console.log(chalk.green(`  ✓ Created starter templates in ${templatesDir}/`));
    }

    const examplePath = join(dir, 'matumailer.example.ts');
    if (!existsSync(examplePath)) {
      writeFileSync(
        examplePath,
        `import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN!,
});

await mail.send({
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome',
  data: { name: 'Juan' },
});
`,
      );
      console.log(chalk.green(`  ✓ Created ${examplePath}`));
    }

    const configPath = join(dir, 'matumailer.config.json');
    if (!existsSync(configPath)) {
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            apiUrl: 'http://localhost:4000',
            templatesDir: './matumailer-templates',
            defaultTemplates: ['welcome', 'password-recovery', 'notification'],
          },
          null,
          2,
        ),
      );
      console.log(chalk.green(`  ✓ Created ${configPath}`));
    }

    console.log(chalk.cyan('\n  Next steps:'));
    console.log('  1. Copy your API token from the MatuMailer dashboard');
    console.log('  2. Set MATUMAILER_TOKEN in .env.matumailer');
    console.log('  3. Run: npx matumailer verify-smtp --email your@gmail.com\n');
  });

program
  .command('verify-smtp')
  .description('Detect SMTP settings from an email address')
  .requiredOption('-e, --email <email>', 'Email address to detect provider')
  .action((opts: { email: string }) => {
    const preset = detectSmtp(opts.email);
    if (!preset) {
      console.log(chalk.yellow('  No known provider detected. Use custom SMTP settings.'));
      return;
    }
    console.log(chalk.green('\n  SMTP Auto-Detection\n'));
    console.log(`  Provider: ${chalk.bold(preset.provider)}`);
    console.log(`  Host:     ${preset.host}`);
    console.log(`  Port:     ${preset.port}`);
    console.log(`  Secure:   ${preset.secure}\n`);
  });

const domains = program.command('domains').description('Gestiona dominios de envío');

domains
  .command('list')
  .description('Lista los dominios configurados para el proyecto')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    const { domains } = await mail.listDomains(loadProjectId());
    if (!domains.length) {
      console.log(
        chalk.yellow('\n  Aún no has añadido dominios. Ejecuta: npx matumailer domains add\n'),
      );
      return;
    }
    console.log(chalk.cyan.bold('\n  Dominios del proyecto\n'));
    for (const d of domains) {
      const statusColor =
        d.status === 'verified' ? chalk.green : d.status === 'failed' ? chalk.red : chalk.yellow;
      console.log(`  ${chalk.bold(d.domain)}  ${statusColor('[' + d.status + ']')}  (${d.region})`);
    }
    console.log();
  });

domains
  .command('add')
  .description('Añade un nuevo dominio y muestra los registros DNS')
  .requiredOption('-d, --domain <domain>', 'Dominio (ej. destin.com)')
  .option('-r, --region <region>', 'Región de envío', 'us-east-1')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { domain: string; region: string; baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    const { domain } = await mail.createDomain(loadProjectId(), {
      domain: opts.domain,
      region: opts.region as 'us-east-1' | 'sa-east-1' | 'eu-west-1',
    });

    console.log(chalk.green(`\n  Dominio ${chalk.bold(domain.domain)} creado.\n`));
    console.log(chalk.cyan('  Registros DNS a publicar en tu proveedor:\n'));
    for (const r of domain.records) {
      console.log(`  ${chalk.bold(r.type)}  ${chalk.gray(r.host)}`);
      console.log(`     ${r.value}`);
      if (r.priority !== null) console.log(`     priority=${r.priority}`);
      console.log();
    }
    console.log(
      chalk.cyan(
        '  Cuando los hayas publicado, ejecuta: npx matumailer domains verify ' + domain.id + '\n',
      ),
    );
  });

domains
  .command('verify')
  .description('Re-verifica los registros DNS de un dominio')
  .requiredOption('--id <id>', 'ID del dominio')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { id: string; baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    const result = await mail.verifyDomain(opts.id);
    if (result.verified) {
      console.log(chalk.green(`\n  ✓ ${result.domain.domain} verificado y listo para enviar.\n`));
    } else {
      console.log(chalk.yellow(`\n  Pendiente. Registros faltantes:\n`));
      for (const m of result.missing) {
        console.log(`   - ${m.type} ${m.host}  (${m.reason})`);
      }
      console.log();
    }
  });

domains
  .command('remove')
  .description('Elimina un dominio del proyecto')
  .requiredOption('--id <id>', 'ID del dominio')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { id: string; baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    await mail.deleteDomain(opts.id);
    console.log(chalk.green(`\n  Dominio ${opts.id} eliminado.\n`));
  });

domains
  .command('default')
  .description('Marca un dominio verificado como default del proyecto')
  .requiredOption('--id <id>', 'ID del dominio')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { id: string; baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    await mail.setDefaultDomain(opts.id);
    console.log(chalk.green(`\n  ${opts.id} ahora es el dominio por defecto.\n`));
  });

const aliasesCmd = program.command('aliases').description('Gestiona aliases de envío');

aliasesCmd
  .command('list')
  .description('Lista los aliases configurados')
  .requiredOption('-p, --project-id <id>', 'ID del proyecto')
  .option('-d, --domain-id <id>', 'Filtrar por dominio')
  .option('--active-only', 'Solo aliases activos', false)
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(
    async (opts: {
      projectId: string;
      domainId?: string;
      activeOnly: boolean;
      baseUrl?: string;
    }) => {
      const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
      const { aliases } = await mail.listAliases(opts.projectId, {
        domainId: opts.domainId,
        activeOnly: opts.activeOnly,
      });
      if (!aliases.length) {
        console.log(chalk.yellow('\n  No hay aliases. Crea uno con: matumailer aliases add\n'));
        return;
      }
      console.log(chalk.cyan.bold('\n  Aliases del proyecto\n'));
      for (const a of aliases) {
        const status = a.is_active ? chalk.green('active') : chalk.red('inactive');
        const def = a.is_default ? chalk.yellow(' ★ default') : '';
        console.log(`  ${a.full_email.padEnd(40)} ${status}${def}  (${a.domain})`);
        if (a.display_name) console.log(`     └ display_name: ${a.display_name}`);
      }
      console.log();
    },
  );

aliasesCmd
  .command('add')
  .description('Crea un nuevo alias')
  .requiredOption('-p, --project-id <id>', 'ID del proyecto')
  .requiredOption('-d, --domain-id <id>', 'ID del dominio verificado')
  .requiredOption('-l, --local-part <part>', 'Parte local (ej: support)')
  .option('-n, --name <name>', 'Display name (ej: Soporte)')
  .option('-r, --reply-to <email>', 'Reply-To por defecto')
  .option('--default', 'Marcar como alias default', false)
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(
    async (opts: {
      projectId: string;
      domainId: string;
      localPart: string;
      name?: string;
      replyTo?: string;
      default: boolean;
      baseUrl?: string;
    }) => {
      const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
      const { alias } = await mail.createAlias(opts.projectId, {
        domainId: opts.domainId,
        localPart: opts.localPart,
        displayName: opts.name ?? null,
        replyTo: opts.replyTo ?? null,
        isDefault: opts.default,
      });
      console.log(chalk.green(`\n  ✓ Alias creado: ${alias.full_email} (id: ${alias.id})\n`));
    },
  );

aliasesCmd
  .command('remove')
  .description('Elimina un alias')
  .requiredOption('--id <id>', 'ID del alias')
  .option('-u, --base-url <url>', 'API URL', process.env.MATUMAILER_API_URL)
  .action(async (opts: { id: string; baseUrl?: string }) => {
    const mail = new MatuMailer({ token: loadToken(), baseUrl: opts.baseUrl });
    await mail.deleteAlias(opts.id);
    console.log(chalk.green(`\n  Alias ${opts.id} eliminado.\n`));
  });

program.parse();
