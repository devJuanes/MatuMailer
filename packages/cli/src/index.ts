#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { detectSmtp } from 'matumailer';

const program = new Command();

program.name('matumailer').description('MatuMailer CLI — email infrastructure setup').version('1.0.0');

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

program.parse();
