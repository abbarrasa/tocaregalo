use strict;
use warnings;
use JSON::PP;
my $root = shift // '.';
open my $fh, '<', "$root/.vscode/tasks.json" or die $!;
my $tasks = decode_json(do { local $/; <$fh> });
my %allowed = map { $_ => 1 } qw(static phpstan backend frontend mail e2e build up down migrate create-super-admin);
for my $task (@{$tasks->{tasks}}) {
    die "Invalid task command" unless $task->{command} =~ m{^\$\{workspaceFolder\}/scripts/(check|dev)$};
    die "Unknown task selection" unless @{$task->{args}} == 1 && $allowed{$task->{args}[0]};
    die "Invalid working directory" unless $task->{options}{cwd} eq '${workspaceFolder}';
    die "Unexpected automatic task" if exists $task->{runOptions};
}
print scalar(@{$tasks->{tasks}}), " task mappings checked.\n";
