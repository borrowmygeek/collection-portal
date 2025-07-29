'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Copy, Database } from 'lucide-react';

export default function MigrationsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const applyAccountPlacements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'apply_account_placements' }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Migration error:', error);
      setResult({ error: 'Failed to apply migration' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAllSQL = () => {
    if (result?.sql_statements) {
      const allSQL = result.sql_statements.join(';\n\n');
      copyToClipboard(allSQL);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Migrations</h1>
        <p className="text-muted-foreground">
          Apply database schema changes and migrations
        </p>
      </div>

      <div className="grid gap-6">
        {/* Account Placements Migration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Account-Level Placement Tracking
            </CardTitle>
            <CardDescription>
              Add account-level placement tracking to allow portfolios to be split across multiple agencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Person-Centric Model</Badge>
                <span className="text-sm text-muted-foreground">persons, debtors, person_addresses, phone_numbers, emails</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline">Features</Badge>
                <span className="text-sm text-muted-foreground">
                  Account-level placement status tracking (new, placed, recalled, closed)
                </span>
              </div>

              <Button 
                onClick={applyAccountPlacements} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Preparing Migration...' : 'Generate Migration SQL'}
              </Button>

              {result && (
                <div className="mt-4 space-y-4">
                  {result.success ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{result.message}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{result.error}</span>
                    </div>
                  )}

                  {result.sql_statements && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">SQL Statements to Execute:</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyAllSQL}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-3 w-3" />
                          {copied ? 'Copied!' : 'Copy All'}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {result.sql_statements.map((sql: string, index: number) => (
                          <div key={index} className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">
                                Statement {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(sql)}
                                className="h-6 px-2 text-xs"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                              <code>{sql}</code>
                            </pre>
                          </div>
                        ))}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h4>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Go to your Supabase Dashboard</li>
                          <li>Navigate to the SQL Editor</li>
                          <li>Copy and paste each SQL statement above</li>
                          <li>Execute them in order</li>
                          <li>Verify the tables are created successfully</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 