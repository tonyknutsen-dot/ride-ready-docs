import { useNavigate } from 'react-router-dom';
import ProfileSetup from '@/components/ProfileSetup';

const ProfileSetupPage = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/overview');
  };

  return <ProfileSetup onComplete={handleComplete} />;
};

export default ProfileSetupPage;
