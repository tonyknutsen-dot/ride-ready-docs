import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { z } from 'zod';
import logo from '@/assets/logo.png';
import { COUNTRIES } from '@/constants/profile';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password must be less than 128 characters')
});

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password must be less than 128 characters'),
  country: z.string().min(1, 'Please select your country')
});

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters')
});

interface FormNotice {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [formData, setFormData] = useState({ email: '', password: '', country: 'GB' });
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formNotice, setFormNotice] = useState<FormNotice | null>(null);
  
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Clear notice when switching tabs
  useEffect(() => {
    setFormNotice(null);
    setErrors({});
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/overview';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const validateForm = (data: typeof formData) => {
    try {
      authSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateResetEmail = (email: string) => {
    try {
      resetSchema.parse({ email });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateSignupForm = (data: typeof formData) => {
    try {
      signupSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isLoading) return;
    
    // Clear previous notices
    setFormNotice(null);
    
    if (activeTab === 'signin') {
      if (!validateForm(formData)) return;
    } else {
      if (!validateSignupForm(formData)) return;
    }

    setIsLoading(true);

    try {
      const { error } = activeTab === 'signin' 
        ? await signIn(formData.email, formData.password)
        : await signUp(formData.email, formData.password, formData.country);

      if (error) {
        const errorMsg = error.message?.toLowerCase() || '';
        
        if (errorMsg.includes('invalid login credentials')) {
          setFormNotice({
            type: 'error',
            title: 'Login failed',
            message: 'Invalid email or password. Please check your credentials and try again.'
          });
        } else if (errorMsg.includes('already registered') || errorMsg.includes('user already') || errorMsg.includes('already exists')) {
          // Account already exists - offer to sign in or reset password
          setFormNotice({
            type: 'info',
            title: 'Account already exists',
            message: 'An account with this email already exists. Please sign in or reset your password below.'
          });
          // Pre-fill reset email and switch to signin tab
          setResetEmail(formData.email);
          setActiveTab('signin');
        } else if (errorMsg.includes('email not confirmed')) {
          setFormNotice({
            type: 'info',
            title: 'Email not confirmed',
            message: 'Please check your email and click the confirmation link before signing in.'
          });
        } else {
          setFormNotice({
            type: 'error',
            title: activeTab === 'signin' ? 'Sign in failed' : 'Sign up failed',
            message: error.message || 'An unexpected error occurred. Please try again.'
          });
        }
      } else {
        if (activeTab === 'signup') {
          setFormNotice({
            type: 'success',
            title: 'Account created!',
            message: 'Please check your email for a confirmation link to complete your registration.'
          });
          // Also show toast for visibility
          toast({
            title: "Account created!",
            description: "Please check your email for a confirmation link.",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          });
        }
      }
    } catch (err) {
      setFormNotice({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateResetEmail(resetEmail)) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        toast({
          title: "Reset failed",
          description: error.message || "Failed to send reset email. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset email sent!",
          description: "Please check your email for password reset instructions.",
        });
        setShowResetForm(false);
        setResetEmail('');
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (showResetForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-up">
          <div className="text-center space-y-3">
            <Link to="/" className="inline-block bg-card p-4 rounded-2xl shadow-card mx-auto hover:shadow-elegant transition-smooth border-2 border-primary/20">
              <img src={logo} alt="Ride Ready Docs home" className="h-28 w-auto" width={112} height={112} loading="lazy" />
            </Link>
            <h1 className="text-2xl font-bold">Reset Password</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email to receive reset instructions
            </p>
          </div>

          <Card className="shadow-elegant border-2 border-primary/20 bg-gradient-to-b from-card to-primary/[0.02]">
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="Enter your email address"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (errors.email) {
                        setErrors(prev => ({ ...prev, email: '' }));
                      }
                    }}
                    disabled={isLoading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Email
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowResetForm(false);
                      setResetEmail('');
                      setErrors({});
                    }}
                    disabled={isLoading}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-up">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block bg-card p-4 rounded-2xl shadow-card mx-auto hover:shadow-elegant transition-smooth border-2 border-primary/20">
            <img src={logo} alt="Ride Ready Docs home" className="h-28 w-auto" width={112} height={112} loading="lazy" />
          </Link>
          <h1 className="text-2xl font-bold">Ride Ready Docs</h1>
          <p className="text-muted-foreground text-sm">
            Access your ride operations system
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 mt-4">
            {formNotice && (
              <Alert variant={formNotice.type === 'error' ? 'destructive' : 'default'} className={
                formNotice.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                formNotice.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
              }>
                {formNotice.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {formNotice.type === 'error' && <AlertCircle className="h-4 w-4" />}
                {formNotice.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                <AlertTitle>{formNotice.title}</AlertTitle>
                <AlertDescription>{formNotice.message}</AlertDescription>
              </Alert>
            )}
            <Card className="shadow-elegant border-2 border-primary/20 bg-gradient-to-b from-card to-primary/[0.02]">
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowResetForm(true)}
                      disabled={isLoading}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            {formNotice && (
              <Alert variant={formNotice.type === 'error' ? 'destructive' : 'default'} className={
                formNotice.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                formNotice.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
              }>
                {formNotice.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {formNotice.type === 'error' && <AlertCircle className="h-4 w-4" />}
                {formNotice.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                <AlertTitle>{formNotice.title}</AlertTitle>
                <AlertDescription>{formNotice.message}</AlertDescription>
              </Alert>
            )}
            <Card className="shadow-elegant border-2 border-accent/20 bg-gradient-to-b from-card to-accent/[0.02]">
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Sign up for a new account to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password (min 6 characters)"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-country">Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, country: value }));
                        if (errors.country) {
                          setErrors(prev => ({ ...prev, country: '' }));
                        }
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.country && (
                      <p className="text-sm text-destructive">{errors.country}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;