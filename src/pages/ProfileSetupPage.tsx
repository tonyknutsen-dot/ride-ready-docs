import { useNavigate } from 'react-router-dom';
import ProfileSetup from '@/components/ProfileSetup';

const ProfileSetupPage = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return <ProfileSetup onComplete={handleComplete} />;
};

export default ProfileSetupPage;
