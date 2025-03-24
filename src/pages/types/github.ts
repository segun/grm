/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name?: string;
  }
  
  export interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    clone_url: string;
    owner: {
      login: string;
      id: number;
    };
    default_branch: string;
  }
  
  export interface GitHubBranch {
    name: string;
    commit: {
      sha: string;
      url: string;
    };
  }
  
  export interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    type: "file" | "dir";
    content?: string;
    encoding?: string;
    repository?: {
      name: string;
      owner: {
        login: string;
      };
    };
    owner?: string;
    repo?: string;
  }
  
  export interface ApiRequest {
    action: string;
    [key: string]: any;
  }