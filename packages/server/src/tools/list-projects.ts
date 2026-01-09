import { z } from 'zod';
import { listProjects, loadProjectConfig } from '@mina-docs/shared';

export const ListProjectsSchema = z.object({});

export async function listProjectsTool(
  _args: z.infer<typeof ListProjectsSchema>
) {
  const projectIds = listProjects();

  let text = '## Available Projects\n\n';

  if (projectIds.length === 0) {
    text += 'No projects configured. Check the `config/projects/` directory.\n';
  } else {
    for (const id of projectIds) {
      try {
        const config = loadProjectConfig(id);
        text += `### ${config.name} (\`${config.id}\`)\n`;
        text += `- Documentation: ${config.docs.baseUrl}\n`;
        if (config.github) {
          text += `- Source: github.com/${config.github.repo}\n`;
        }
        text += '\n';
      } catch {
        text += `### ${id}\n(Config error)\n\n`;
      }
    }

    text += '\nUse the project ID (e.g., `"mina"`) in the `project` parameter of other tools.';
  }

  return { content: [{ type: 'text', text }] };
}
