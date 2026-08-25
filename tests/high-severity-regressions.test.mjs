import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('supabase/migrations/20260819000100_functional_database_baseline.sql');
const notesClient = read('app/(main)/notes/NotesClient.tsx');
const bookmarksClient = read('app/(main)/bookmarks/BookmarksClient.tsx');

test('baseline migration defines every application table', () => {
  const expectedTables = [
    'bookmark_boards',
    'bookmark_folders',
    'bookmarks',
    'groups',
    'todos',
    'push_subscriptions',
    'note_groups',
    'tags',
    'notes',
    'note_tags',
  ];

  for (const table of expectedTables) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${table}\\s*\\(`, 'i'),
      `missing table ${table}`,
    );
  }

  assert.match(migration, /bookmark_folders[\s\S]*board_id uuid references public\.bookmark_boards/i);
  assert.match(migration, /bookmark_folders[\s\S]*color text/i);
});

test('note create and update use transactional RPCs', () => {
  assert.match(migration, /create or replace function public\.create_note_with_tags/i);
  assert.match(migration, /create or replace function public\.update_note_with_tags/i);
  assert.match(migration, /update public\.notes[\s\S]*delete from public\.note_tags[\s\S]*insert into public\.note_tags/i);
  assert.match(notesClient, /\.rpc\('create_note_with_tags'/);
  assert.match(notesClient, /\.rpc\('update_note_with_tags'/);
  assert.doesNotMatch(notesClient, /from\('note_tags'\)\.delete\(\)/);
});

test('bookmark import is one atomic RPC call with no client-side chunk writes', () => {
  const importStart = bookmarksClient.indexOf('const handleImport = async');
  const importEnd = bookmarksClient.indexOf('const getDomain =', importStart);
  assert.notEqual(importStart, -1, 'handleImport not found');
  assert.notEqual(importEnd, -1, 'handleImport end marker not found');

  const importHandler = bookmarksClient.slice(importStart, importEnd);
  assert.match(migration, /create or replace function public\.import_bookmarks_transactional/i);
  assert.match(importHandler, /\.rpc\('import_bookmarks_transactional'/);
  assert.doesNotMatch(importHandler, /from\('bookmark_folders'\)\.insert/);
  assert.doesNotMatch(importHandler, /from\('bookmarks'\)\.insert/);
  assert.doesNotMatch(importHandler, /chunkSize/);
});

test('transactional RPCs are granted to authenticated clients', () => {
  assert.match(migration, /grant execute on function public\.create_note_with_tags[\s\S]*to authenticated/i);
  assert.match(migration, /grant execute on function public\.update_note_with_tags[\s\S]*to authenticated/i);
  assert.match(migration, /grant execute on function public\.import_bookmarks_transactional[\s\S]*to authenticated/i);
});
