const mongoose = require('mongoose');
const DsaQuestion = require('../models/DsaQuestion');
const logger = require('../utils/logger');
require('dotenv').config();

const questions = [
  {
    title: "Two Sum",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.\n\n**Input Format**:\nLine 1: Space-separated integers representing the array.\nLine 2: Target integer.\n\n**Output Format**:\nTwo space-separated indices.",
    difficulty: "easy",
    domain: "Arrays",
    constraints: "2 ≤ nums.length ≤ 10^4\n-10^9 ≤ nums[i] ≤ 10^9\n-10^9 ≤ target ≤ 10^9",
    inputFormat: "First line: space-separated integers\nSecond line: integer",
    outputFormat: "Two space-separated integers",
    sampleInput: "2 7 11 15\n9",
    sampleOutput: "0 1",
    testCases: [{"input":"2 7 11 15\n9","expectedOutput":"0 1","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"3 2 4\n6","expectedOutput":"1 2","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"3 3\n6","expectedOutput":"0 1","isHidden":true,"timeLimit":2000,"memoryLimit":262144},{"input":"0 4 3 0\n0","expectedOutput":"0 3","isHidden":true,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Your code here
  
}

// --- Driver Code ---
const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n');
if (input.length >= 2) {
  const nums = input[0].split(' ').map(Number);
  const target = parseInt(input[1]);
  const result = twoSum(nums, target);
  if (result) console.log(result.join(' '));
}`,
      java: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your code here
        return new int[]{};
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String[] parts = sc.nextLine().trim().split("\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        if (!sc.hasNextLine()) return;
        int target = Integer.parseInt(sc.nextLine().trim());
        Solution sol = new Solution();
        int[] result = sol.twoSum(nums, target);
        if (result != null && result.length >= 2) {
            System.out.println(result[0] + " " + result[1]);
        }
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Your code here
        return {};
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line)) return 0;
    istringstream iss(line);
    vector<int> nums;
    int x;
    while (iss >> x) nums.push_back(x);
    int target;
    if (!(cin >> target)) return 0;
    Solution sol;
    vector<int> result = sol.twoSum(nums, target);
    if (result.size() >= 2) {
        cout << result[0] << " " << result[1] << endl;
    }
    return 0;
}`,
    },
    driverCode: {},
    tags: ["hash-map","arrays","two-pointer"]
  },
  {
    title: "Valid Parentheses",
    description: "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[`, and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.",
    difficulty: "easy",
    domain: "Stacks",
    constraints: "1 ≤ s.length ≤ 10^4\ns consists of parentheses only: ()[]{}",
    inputFormat: "A single string of brackets",
    outputFormat: "true or false",
    sampleInput: "()",
    sampleOutput: "true",
    testCases: [{"input":"()","expectedOutput":"true","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"()[]{}","expectedOutput":"true","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"(]","expectedOutput":"false","isHidden":true,"timeLimit":2000,"memoryLimit":262144},{"input":"([)]","expectedOutput":"false","isHidden":true,"timeLimit":2000,"memoryLimit":262144},{"input":"{[]}","expectedOutput":"true","isHidden":true,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  // Your code here
  return false;
}

// --- Driver Code ---
const fs = require('fs');
const s = fs.readFileSync('/dev/stdin', 'utf8').trim();
console.log(isValid(s) ? 'true' : 'false');`,
      java: `import java.util.*;

class Solution {
    public boolean isValid(String s) {
        // Your code here
        return false;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine().trim() : "";
        Solution sol = new Solution();
        System.out.println(sol.isValid(s) ? "true" : "false");
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Your code here
        return false;
    }
};

// --- Driver Code ---
int main() {
    string s;
    if (getline(cin, s)) {
        Solution sol;
        cout << (sol.isValid(s) ? "true" : "false") << endl;
    }
    return 0;
}`,
    },
    driverCode: {},
    tags: ["stacks","strings"]
  },
  {
    title: "Reverse a Linked List",
    description: "Given the head of a singly linked list represented as space-separated values, reverse it and return the new head.\n\n*(Note: For simplicity, the driver code provides an array, return the reversed array instead of a linked list object)*",
    difficulty: "easy",
    domain: "Linked Lists",
    constraints: "0 ≤ number of nodes ≤ 5000\n-5000 ≤ Node.val ≤ 5000",
    inputFormat: "A single line of space-separated integers",
    outputFormat: "A single line of space-separated integers (reversed)",
    sampleInput: "1 2 3 4 5",
    sampleOutput: "5 4 3 2 1",
    testCases: [{"input":"1 2 3 4 5","expectedOutput":"5 4 3 2 1","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"1 2","expectedOutput":"2 1","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"1","expectedOutput":"1","isHidden":true,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} head
 * @return {number[]}
 */
function reverseList(head) {
  // Your code here
  return [];
}

// --- Driver Code ---
const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf8').trim();
if (!input) { console.log(""); process.exit(0); }
const head = input.split(' ').map(Number);
const result = reverseList(head);
console.log(result.join(' '));`,
      java: `import java.util.*;

import java.util.*;
class Solution {
    public int[] reverseList(int[] head) {
        // Your code here
        return new int[]{};
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) { System.out.println(""); return; }
        String line = sc.nextLine().trim();
        if (line.isEmpty()) { System.out.println(""); return; }
        String[] parts = line.split("\\s+");
        int[] head = new int[parts.length];
        for (int i = 0; i < parts.length; i++) head[i] = Integer.parseInt(parts[i]);
        Solution sol = new Solution();
        int[] result = sol.reverseList(head);
        if (result != null) {
            for (int i = 0; i < result.length; i++) {
                System.out.print(result[i] + (i == result.length - 1 ? "" : " "));
            }
            System.out.println();
        }
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> reverseList(vector<int>& head) {
        // Your code here
        return {};
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line) || line.empty()) { cout << endl; return 0; }
    istringstream iss(line);
    vector<int> head;
    int x;
    while (iss >> x) head.push_back(x);
    Solution sol;
    vector<int> result = sol.reverseList(head);
    for (int i = 0; i < result.size(); i++) {
        cout << result[i] << (i == result.size() - 1 ? "" : " ");
    }
    cout << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["linked-list","in-place"]
  },
  {
    title: "Maximum Depth of Binary Tree",
    description: "Given a binary tree represented as an array (level-order traversal), find its maximum depth.\n\n*(Note: the driver code provides the array directly. Nulls are represented as -1)*",
    difficulty: "easy",
    domain: "Trees",
    constraints: "0 ≤ number of nodes ≤ 10^4",
    inputFormat: "Space-separated values",
    outputFormat: "A single integer",
    sampleInput: "3 9 20 -1 -1 15 7",
    sampleOutput: "3",
    testCases: [{"input":"3 9 20 -1 -1 15 7","expectedOutput":"3","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"1 -1 2","expectedOutput":"2","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} tree
 * @return {number}
 */
function maxDepth(tree) {
  // Your code here
  return 0;
}

// --- Driver Code ---
const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf8').trim();
if (!input) { console.log(0); process.exit(0); }
const tree = input.split(' ').map(Number);
console.log(maxDepth(tree));`,
      java: `import java.util.*;

class Solution {
    public int maxDepth(int[] tree) {
        // Your code here
        return 0;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) { System.out.println(0); return; }
        String line = sc.nextLine().trim();
        if (line.isEmpty()) { System.out.println(0); return; }
        String[] parts = line.split("\\s+");
        int[] tree = new int[parts.length];
        for (int i = 0; i < parts.length; i++) tree[i] = Integer.parseInt(parts[i]);
        Solution sol = new Solution();
        System.out.println(sol.maxDepth(tree));
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int maxDepth(vector<int>& tree) {
        // Your code here
        return 0;
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line) || line.empty()) { cout << 0 << endl; return 0; }
    istringstream iss(line);
    vector<int> tree;
    int x;
    while (iss >> x) tree.push_back(x);
    Solution sol;
    cout << sol.maxDepth(tree) << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["trees","dfs","bfs"]
  },
  {
    title: "Climbing Stairs",
    description: "You are climbing a staircase. It takes `n` steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    difficulty: "easy",
    domain: "Dynamic Programming",
    constraints: "1 ≤ n ≤ 45",
    inputFormat: "A single integer n",
    outputFormat: "A single integer",
    sampleInput: "3",
    sampleOutput: "3",
    testCases: [{"input":"2","expectedOutput":"2","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"3","expectedOutput":"3","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"45","expectedOutput":"1836311903","isHidden":true,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
function climbStairs(n) {
  // Your code here
  return 0;
}

// --- Driver Code ---
const fs = require('fs');
const n = parseInt(fs.readFileSync('/dev/stdin', 'utf8').trim());
console.log(climbStairs(n));`,
      java: `import java.util.*;

class Solution {
    public int climbStairs(int n) {
        // Your code here
        return 0;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            Solution sol = new Solution();
            System.out.println(sol.climbStairs(sc.nextInt()));
        }
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int climbStairs(int n) {
        // Your code here
        return 0;
    }
};

// --- Driver Code ---
int main() {
    int n;
    if (cin >> n) {
        Solution sol;
        cout << sol.climbStairs(n) << endl;
    }
    return 0;
}`,
    },
    driverCode: {},
    tags: ["dynamic-programming","math"]
  },
  {
    title: "Number of Islands",
    description: "Given an `m x n` 2D grid of `1`s (land) and `0`s (water), count the number of islands.",
    difficulty: "medium",
    domain: "Graphs",
    constraints: "1 ≤ m, n ≤ 300",
    inputFormat: "First line: m n\nNext m lines: grid",
    outputFormat: "A single integer",
    sampleInput: "4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0",
    sampleOutput: "1",
    testCases: [{"input":"4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0","expectedOutput":"1","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1","expectedOutput":"3","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {character[][]} grid
 * @return {number}
 */
function numIslands(grid) {
  // Your code here
  return 0;
}

// --- Driver Code ---
const fs = require('fs');
const lines = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n');
if (lines.length > 0 && lines[0].trim().length > 0) {
  const [m, n] = lines[0].split(' ').map(Number);
  const grid = [];
  for (let i = 1; i <= m; i++) grid.push(lines[i].trim().split(/\s+/));
  console.log(numIslands(grid));
}`,
      java: `import java.util.*;

class Solution {
    public int numIslands(char[][] grid) {
        // Your code here
        return 0;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int m = sc.nextInt(); 
        int n = sc.nextInt(); 
        if (sc.hasNextLine()) sc.nextLine();
        char[][] grid = new char[m][n];
        for (int i = 0; i < m; i++) {
            String[] parts = sc.nextLine().trim().split("\\s+");
            for (int j = 0; j < n; j++) grid[i][j] = parts[j].charAt(0);
        }
        Solution sol = new Solution();
        System.out.println(sol.numIslands(grid));
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        // Your code here
        return 0;
    }
};

// --- Driver Code ---
int main() {
    int m, n;
    if (!(cin >> m >> n)) return 0;
    vector<vector<char>> grid(m, vector<char>(n));
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            cin >> grid[i][j];
        }
    }
    Solution sol;
    cout << sol.numIslands(grid) << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["graphs","dfs","bfs","matrix"]
  },
  {
    title: "Merge Sort",
    description: "Sort an array of integers in ascending order. You must implement the merge sort algorithm.",
    difficulty: "medium",
    domain: "Sorting",
    constraints: "1 ≤ nums.length ≤ 5*10^4\n-50000 ≤ nums[i] ≤ 50000",
    inputFormat: "Space separated integers",
    outputFormat: "Space separated sorted integers",
    sampleInput: "5 2 3 1",
    sampleOutput: "1 2 3 5",
    testCases: [{"input":"5 2 3 1","expectedOutput":"1 2 3 5","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"5 1 1 2 0 0","expectedOutput":"0 0 1 1 2 5","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number[]}
 */
function sortArray(nums) {
  // Your code here
  return nums;
}

// --- Driver Code ---
const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf8').trim();
if (!input) process.exit(0);
const nums = input.split(' ').map(Number);
console.log(sortArray(nums).join(' '));`,
      java: `import java.util.*;

class Solution {
    public int[] sortArray(int[] nums) {
        // Your code here
        return nums;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String line = sc.nextLine().trim();
        if (line.isEmpty()) return;
        String[] parts = line.split("\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        Solution sol = new Solution();
        int[] result = sol.sortArray(nums);
        for (int i = 0; i < result.length; i++) {
            System.out.print(result[i] + (i == result.length - 1 ? "" : " "));
        }
        System.out.println();
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> sortArray(vector<int>& nums) {
        // Your code here
        return nums;
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line) || line.empty()) return 0;
    istringstream iss(line);
    vector<int> nums;
    int x;
    while (iss >> x) nums.push_back(x);
    Solution sol;
    vector<int> result = sol.sortArray(nums);
    for (int i = 0; i < result.size(); i++) {
        cout << result[i] << (i == result.size() - 1 ? "" : " ");
    }
    cout << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["sorting","divide-and-conquer"]
  },
  {
    title: "Binary Search",
    description: "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.",
    difficulty: "easy",
    domain: "Searching",
    constraints: "1 ≤ nums.length ≤ 10^4",
    inputFormat: "Line 1: space separated sorted integers\nLine 2: target integer",
    outputFormat: "A single integer (index or -1)",
    sampleInput: "-1 0 3 5 9 12\n9",
    sampleOutput: "4",
    testCases: [{"input":"-1 0 3 5 9 12\n9","expectedOutput":"4","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"-1 0 3 5 9 12\n2","expectedOutput":"-1","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  // Your code here
  return -1;
}

// --- Driver Code ---
const fs = require('fs');
const lines = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n');
if (lines.length >= 2) {
  const nums = lines[0].split(' ').map(Number);
  const target = parseInt(lines[1]);
  console.log(search(nums, target));
}`,
      java: `import java.util.*;

class Solution {
    public int search(int[] nums, int target) {
        // Your code here
        return -1;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String[] parts = sc.nextLine().trim().split("\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        if (!sc.hasNextLine()) return;
        int target = Integer.parseInt(sc.nextLine().trim());
        Solution sol = new Solution();
        System.out.println(sol.search(nums, target));
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Your code here
        return -1;
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line)) return 0;
    istringstream iss(line);
    vector<int> nums;
    int x;
    while (iss >> x) nums.push_back(x);
    int target;
    if (!(cin >> target)) return 0;
    Solution sol;
    cout << sol.search(nums, target) << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["binary-search","arrays"]
  },
  {
    title: "Coin Change",
    description: "You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.",
    difficulty: "medium",
    domain: "Dynamic Programming",
    constraints: "1 ≤ coins.length ≤ 12\n0 ≤ amount ≤ 10^4",
    inputFormat: "Line 1: space-separated coins\nLine 2: amount",
    outputFormat: "A single integer",
    sampleInput: "1 2 5\n11",
    sampleOutput: "3",
    testCases: [{"input":"1 2 5\n11","expectedOutput":"3","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"2\n3","expectedOutput":"-1","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
function coinChange(coins, amount) {
  // Your code here
  return -1;
}

// --- Driver Code ---
const fs = require('fs');
const lines = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n');
if (lines.length >= 2) {
  const coins = lines[0].split(' ').map(Number);
  const amount = parseInt(lines[1]);
  console.log(coinChange(coins, amount));
}`,
      java: `import java.util.*;

class Solution {
    public int coinChange(int[] coins, int amount) {
        // Your code here
        return -1;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String[] parts = sc.nextLine().trim().split("\\s+");
        int[] coins = new int[parts.length];
        for (int i = 0; i < parts.length; i++) coins[i] = Integer.parseInt(parts[i]);
        if (!sc.hasNextLine()) return;
        int amount = Integer.parseInt(sc.nextLine().trim());
        Solution sol = new Solution();
        System.out.println(sol.coinChange(coins, amount));
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        // Your code here
        return -1;
    }
};

// --- Driver Code ---
int main() {
    string line;
    if (!getline(cin, line)) return 0;
    istringstream iss(line);
    vector<int> coins;
    int x;
    while (iss >> x) coins.push_back(x);
    int amount;
    if (!(cin >> amount)) return 0;
    Solution sol;
    cout << sol.coinChange(coins, amount) << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["dynamic-programming","bfs"]
  },
  {
    title: "Course Schedule",
    description: "There are a total of `numCourses` courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai.\nReturn true if you can finish all courses. Otherwise, return false.",
    difficulty: "hard",
    domain: "Graphs",
    constraints: "1 ≤ numCourses ≤ 2000",
    inputFormat: "Line 1: numCourses P (number of prerequisites)\nNext P lines: a b",
    outputFormat: "true or false",
    sampleInput: "2 1\n1 0",
    sampleOutput: "true",
    testCases: [{"input":"2 1\n1 0","expectedOutput":"true","isHidden":false,"timeLimit":2000,"memoryLimit":262144},{"input":"2 2\n1 0\n0 1","expectedOutput":"false","isHidden":false,"timeLimit":2000,"memoryLimit":262144}],
    starterCode: {
      javascript: `/**
 * @param {number} numCourses
 * @param {number[][]} prerequisites
 * @return {boolean}
 */
function canFinish(numCourses, prerequisites) {
  // Your code here
  return false;
}

// --- Driver Code ---
const fs = require('fs');
const lines = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n');
if (lines.length > 0) {
  const [numCourses, p] = lines[0].split(' ').map(Number);
  const prereqs = [];
  for (let i = 1; i <= p; i++) {
    prereqs.push(lines[i].trim().split(' ').map(Number));
  }
  console.log(canFinish(numCourses, prereqs) ? 'true' : 'false');
}`,
      java: `import java.util.*;

class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        // Your code here
        return false;
    }
}

// --- Driver Code ---
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int numCourses = sc.nextInt();
        int p = sc.nextInt();
        int[][] prerequisites = new int[p][2];
        for (int i = 0; i < p; i++) {
            prerequisites[i][0] = sc.nextInt();
            prerequisites[i][1] = sc.nextInt();
        }
        Solution sol = new Solution();
        System.out.println(sol.canFinish(numCourses, prerequisites) ? "true" : "false");
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        // Your code here
        return false;
    }
};

// --- Driver Code ---
int main() {
    int numCourses, p;
    if (!(cin >> numCourses >> p)) return 0;
    vector<vector<int>> prerequisites(p, vector<int>(2));
    for (int i = 0; i < p; i++) {
        cin >> prerequisites[i][0] >> prerequisites[i][1];
    }
    Solution sol;
    cout << (sol.canFinish(numCourses, prerequisites) ? "true" : "false") << endl;
    return 0;
}`,
    },
    driverCode: {},
    tags: ["graphs","topological-sort"]
  }
];

async function seedDsaQuestions() {
  try {
    const count = await DsaQuestion.countDocuments({ source: 'system' });
    if (count >= questions.length) {
      return;
    }

    await DsaQuestion.deleteMany({ source: 'system' });
    logger.info('Cleared existing system DSA questions');

    const formattedQuestions = questions.map(q => ({
      ...q,
      source: 'system',
      jobPostingId: null,
    }));

    await DsaQuestion.insertMany(formattedQuestions);
    logger.info(`Successfully seeded ${questions.length} DSA questions`);
  } catch (err) {
    logger.error('Error seeding DSA questions:', err);
  }
}

module.exports = { seedDsaQuestions };
