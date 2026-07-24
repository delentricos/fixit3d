export interface Plugin {
  id: string;
  name: string;
  version: string;
  category: string;
  status: string;

  description: string;
  author: string;

  capabilities: string[];
}