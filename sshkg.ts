// Key Generation API Server (TypeScript)
import express, { Request, Response } from 'express';
import { exec, ExecException } from 'child_process';

// Define interfaces for our responses
interface KeyPairResponse {
  privateKey: string;
  publicKey: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
}

interface CopyPublicKeyRequest {
  publicKey: string;
}

const app = express();
const port = 3000;

app.get('/generate-ssh-keys', (req: Request, res: Response<KeyPairResponse | ErrorResponse>) => {
  console.log('Received request to generate SSH keys');
  
  // Ensure the temp directory is writable first
  exec('touch /tmp/test_write && rm /tmp/test_write', (touchErr) => {
    if (touchErr) {
      console.error('Error: Cannot write to /tmp directory:', touchErr.message);
      return res.status(500).json({ error: 'Cannot write to temporary directory' });
    }
    
    console.log('Confirmed /tmp directory is writable');
    
    // Generate a key pair with no passphrase - use correct flags
    // -f specifies the filename, -N "" means empty passphrase, -q is quiet mode
    console.log('Executing: ssh-keygen -t ed25519 -f /tmp/temp_key -N "" -q');
    
    const childProcess = exec('ssh-keygen -t ed25519 -f /tmp/temp_key -N "" -q', { timeout: 5000 }, (error: ExecException | null, stdout: string, stderr: string) => {
      if (error) {
        console.error('Error generating SSH keys:', error.message);
        return res.status(500).json({ error: error.message });
      }
      
      console.log('Successfully generated SSH keys');
      console.log('Stdout:', stdout);
      
      if (stderr) {
        console.log('Stderr:', stderr);
      }
      
      // Add a file existence check before reading
      exec('ls -la /tmp/temp_key*', (lsErr, lsOutput) => {
        console.log('Key files check:', lsOutput || 'No output');
        
        if (lsErr) {
          console.error('Error checking key files:', lsErr.message);
          return res.status(500).json({ error: 'Could not verify key files were created' });
        }
        
        if (!lsOutput || !lsOutput.includes('temp_key')) {
          console.error('Key files not found after generation');
          return res.status(500).json({ error: 'Key files were not created properly' });
        }
        
        // Read the generated keys separately
        console.log('Reading private key from /tmp/temp_key');
        exec('cat /tmp/temp_key', { timeout: 3000 }, (errPrivate: ExecException | null, privateKey: string) => {
          if (errPrivate) {
            console.error('Error reading private key:', errPrivate.message);
            return res.status(500).json({ error: errPrivate.message });
          }
          
          console.log('Successfully read private key (length):', privateKey.length);
          
          console.log('Reading public key from /tmp/temp_key.pub');
          exec('cat /tmp/temp_key.pub', { timeout: 3000 }, (errPublic: ExecException | null, publicKey: string) => {
            if (errPublic) {
              console.error('Error reading public key:', errPublic.message);
              return res.status(500).json({ error: errPublic.message });
            }
            
            console.log('Successfully read public key (length):', publicKey.length);
          
            const response = {
              privateKey: privateKey.trim(),
              publicKey: publicKey.trim()
            };
            
            console.log('Sending response with keys');
            console.log('Private key (first 20 chars):', response.privateKey.substring(0, 20) + '...');
            console.log('Public key (first 20 chars):', response.publicKey.substring(0, 20) + '...');
            
            res.json(response);
            
            // Clean up
            console.log('Cleaning up temporary key files');
            exec('rm /tmp/temp_key /tmp/temp_key.pub', (cleanupErr, cleanupOut) => {
              if (cleanupErr) {
                console.error('Error cleaning up temporary files:', cleanupErr.message);
              } else {
                console.log('Successfully cleaned up temporary files');
              }
            });
          });
        });
      });
    });
    
    // Add a additional timeout safety net
    setTimeout(() => {
      if (!childProcess.killed) {
        console.error('SSH key generation timed out, killing process');
        childProcess.kill();
        if (!res.headersSent) {
          return res.status(500).json({ error: 'SSH key generation timed out' });
        }
      }
    }, 10000);
  });
});

app.use(express.json());

app.post('/copy-public-key', (req: Request<{}, {}, CopyPublicKeyRequest>, res: Response<SuccessResponse | ErrorResponse>) => {
  console.log('Received request to copy public key to SSH container');
  
  const { publicKey } = req.body;
  
  if (!publicKey) {
    console.error('Missing public key in request body');
    return res.status(400).json({ error: 'Public key is required' });
  }
  
  console.log('Public key received (first 20 chars):', publicKey.substring(0, 20) + '...');
  
  // Create a temporary file with the public key
  console.log('Creating temporary file with public key');
  exec(`echo "${publicKey}" > /tmp/temp_pub_key`, (error: ExecException | null) => {
    if (error) {
      console.error('Error creating temporary file:', error.message);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Successfully created temporary file with public key');
    
    // Copy the public key to the container
    console.log('Creating .ssh directory in container');
    exec('docker exec ssh-container mkdir -p /root/.ssh', (error: ExecException | null) => {
      if (error) {
        console.error('Error creating .ssh directory in container:', error.message);
        return res.status(500).json({ error: 'Failed to create .ssh directory in container' });
      }
      
      console.log('Successfully created .ssh directory in container');
      console.log('Copying public key to container');
      
      exec('docker cp /tmp/temp_pub_key ssh-container:/root/.ssh/authorized_keys', (error: ExecException | null) => {
        if (error) {
          console.error('Error copying public key to container:', error.message);
          return res.status(500).json({ error: error.message });
        }
        
        console.log('Successfully copied public key to container');
        
        // Set proper permissions
        console.log('Setting permissions on .ssh directory (700)');
        exec('docker exec ssh-container chmod 700 /root/.ssh', (error: ExecException | null) => {
          if (error) {
            console.error('Error setting permissions on .ssh directory:', error.message);
            return res.status(500).json({ error: 'Failed to set permissions on .ssh directory' });
          }
          
          console.log('Successfully set permissions on .ssh directory');
          console.log('Setting permissions on authorized_keys file (600)');
          
          exec('docker exec ssh-container chmod 600 /root/.ssh/authorized_keys', (error: ExecException | null) => {
            if (error) {
              console.error('Error setting permissions on authorized_keys file:', error.message);
              return res.status(500).json({ error: 'Failed to set permissions on authorized_keys file' });
            }
            
            console.log('Successfully set permissions on authorized_keys file');
            console.log('Public key successfully copied to container');
            
            res.json({ success: true });
            
            // Clean up
            console.log('Cleaning up temporary public key file');
            exec('rm /tmp/temp_pub_key', (cleanupErr) => {
              if (cleanupErr) {
                console.error('Error cleaning up temporary public key file:', cleanupErr.message);
              } else {
                console.log('Successfully cleaned up temporary public key file');
              }
            });
          });
        });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Key generation server running on port ${port}`);
  console.log(`Routes available:`);
  console.log(`- GET /generate-ssh-keys`);
  console.log(`- POST /copy-public-key`);
});