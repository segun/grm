import RepoManager from '@/components/RepoManager';
import type { NextPage } from 'next';

const Home: NextPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">GitHub Repository Manager</h1>
      <RepoManager />
    </div>
  );
};

export default Home;