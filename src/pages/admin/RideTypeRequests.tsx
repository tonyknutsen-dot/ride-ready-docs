import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface RideTypeRequest {
  id: string;
  name: string;
  type: string;
  description: string;
  manufacturer: string | null;
  additional_info: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function RideTypeRequests() {
  const [requests, setRequests] = useState<RideTypeRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('ride_type_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load requests',
        variant: 'destructive',
      });
      return;
    }

    setRequests(data || []);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('ride_type_requests')
      .update({ status, admin_notes: adminNotes })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: `Request ${status}`,
    });

    setSelectedRequest(null);
    setAdminNotes('');
    fetchRequests();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ride Type Requests</h1>
          <p className="text-muted-foreground mt-2">Review and manage ride type requests from users</p>
        </div>

        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{request.name}</CardTitle>
                    <CardDescription>
                      Type: {request.type.charAt(0).toUpperCase() + request.type.slice(1)} • 
                      Submitted {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Description:</p>
                  <p className="text-sm text-muted-foreground">{request.description}</p>
                </div>

                {request.manufacturer && (
                  <div>
                    <p className="text-sm font-medium mb-1">Manufacturer:</p>
                    <p className="text-sm text-muted-foreground">{request.manufacturer}</p>
                  </div>
                )}

                {request.additional_info && (
                  <div>
                    <p className="text-sm font-medium mb-1">Additional Information:</p>
                    <p className="text-sm text-muted-foreground">{request.additional_info}</p>
                  </div>
                )}

                {request.status === 'pending' && (
                  <>
                    {selectedRequest === request.id && (
                      <div className="space-y-3 pt-4 border-t">
                        <div>
                          <label className="text-sm font-medium">Admin Notes (Optional)</label>
                          <Textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Add any notes about this decision..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => updateStatus(request.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => updateStatus(request.id, 'rejected')}
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(null);
                              setAdminNotes('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedRequest !== request.id && (
                      <Button onClick={() => setSelectedRequest(request.id)}>
                        Review Request
                      </Button>
                    )}
                  </>
                )}

                {request.admin_notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Admin Notes:</p>
                    <p className="text-sm text-muted-foreground">{request.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {requests.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No ride type requests yet
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
