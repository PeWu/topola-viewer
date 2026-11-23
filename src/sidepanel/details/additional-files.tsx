import {List, Text} from '@mantine/core';
import {IconPointFilled} from '@tabler/icons-react';

export interface FileEntry {
  url: string;
  filename?: string;
  titl?: string;
}

interface Props {
  files?: FileEntry[];
}

export function AdditionalFiles({files}: Props) {
  if (!files?.length) return null;

  return (
    <List spacing={6} size="sm">
      {files.map((file, index) => (
        <List.Item
          key={index}
          icon={
            <IconPointFilled
              size={12}
              style={{color: 'rgba(0, 0, 0, 0.87)', verticalAlign: 'middle'}}
            />
          }
        >
          <Text size="sm" fw={700} style={{lineHeight: 1.2857}}>
            <a target="_blank" href={file.url} rel="noopener noreferrer">
              {file.filename || file.url.split('/').pop() || file.url}
            </a>
          </Text>
          {file.titl && (
            <Text
              size="sm"
              style={{color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.35}}
            >
              {file.titl}
            </Text>
          )}
        </List.Item>
      ))}
    </List>
  );
}
