/**
 * DSA Question Seeder
 * Seeds 8 pre-defined DSA questions covering major domains.
 * Each question has proper test cases and starter code for all 6 supported languages.
 */
const DsaQuestion = require('../models/DsaQuestion');
const logger = require('../utils/logger');

const SYSTEM_QUESTIONS = [
  // ── 1. Arrays: Two Sum (Easy) ──────────────────────────────────────
  {
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

Return the answer as two space-separated indices (0-indexed) in ascending order.`,
    difficulty: 'easy',
    domain: 'Arrays',
    constraints: '2 ≤ nums.length ≤ 10^4\n-10^9 ≤ nums[i] ≤ 10^9\n-10^9 ≤ target ≤ 10^9',
    inputFormat: 'First line: space-separated integers (the array)\nSecond line: an integer (the target)',
    outputFormat: 'Two space-separated integers (the indices)',
    sampleInput: '2 7 11 15\n9',
    sampleOutput: '0 1',
    testCases: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '3 2 4\n6', expectedOutput: '1 2', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '3 3\n6', expectedOutput: '0 1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 5 3 7 2\n9', expectedOutput: '1 3', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '-1 -2 -3 -4 -5\n-8', expectedOutput: '2 4', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '0 4 3 0\n0', expectedOutput: '0 3', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', l => lines.push(l));
rl.on('close', () => {
  const nums = lines[0].split(' ').map(Number);
  const target = parseInt(lines[1]);
  // Your solution here
  const map = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map[complement] !== undefined) {
      console.log(map[complement] + ' ' + i);
      return;
    }
    map[nums[i]] = i;
  }
});`,
      java: `import java.util.*;
public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    String[] parts = sc.nextLine().split(" ");
    int[] nums = new int[parts.length];
    for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
    int target = Integer.parseInt(sc.nextLine().trim());
    // Your solution here
    Map<Integer,Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      int comp = target - nums[i];
      if (map.containsKey(comp)) {
        System.out.println(map.get(comp) + " " + i);
        return;
      }
      map.put(nums[i], i);
    }
  }
}`,
      c: `#include <stdio.h>
#include <stdlib.h>
int main() {
  int nums[10001], n = 0;
  char line[100000];
  fgets(line, sizeof(line), stdin);
  char *p = line;
  while (*p) {
    if (*p == '-' || (*p >= '0' && *p <= '9')) {
      nums[n++] = strtol(p, &p, 10);
    } else p++;
  }
  int target;
  scanf("%d", &target);
  // Brute force for simplicity in C
  for (int i = 0; i < n; i++)
    for (int j = i+1; j < n; j++)
      if (nums[i] + nums[j] == target) {
        printf("%d %d\\n", i, j);
        return 0;
      }
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  string line;
  getline(cin, line);
  istringstream iss(line);
  vector<int> nums;
  int x;
  while (iss >> x) nums.push_back(x);
  int target;
  cin >> target;
  unordered_map<int,int> mp;
  for (int i = 0; i < nums.size(); i++) {
    int comp = target - nums[i];
    if (mp.count(comp)) {
      cout << mp[comp] << " " << i << endl;
      return 0;
    }
    mp[nums[i]] = i;
  }
  return 0;
}`,
      kotlin: `fun main() {
  val nums = readLine()!!.split(" ").map { it.toInt() }
  val target = readLine()!!.trim().toInt()
  val map = mutableMapOf<Int, Int>()
  for (i in nums.indices) {
    val comp = target - nums[i]
    if (comp in map) {
      println("\${map[comp]} $i")
      return
    }
    map[nums[i]] = i
  }
}`,
      go: `package main
import (
  "bufio"
  "fmt"
  "os"
  "strconv"
  "strings"
)
func main() {
  reader := bufio.NewReader(os.Stdin)
  line, _ := reader.ReadString('\\n')
  parts := strings.Fields(strings.TrimSpace(line))
  nums := make([]int, len(parts))
  for i, p := range parts {
    nums[i], _ = strconv.Atoi(p)
  }
  var target int
  fmt.Fscan(reader, &target)
  mp := map[int]int{}
  for i, v := range nums {
    comp := target - v
    if j, ok := mp[comp]; ok {
      fmt.Printf("%d %d\\n", j, i)
      return
    }
    mp[v] = i
  }
}`,
    },
    tags: ['hash-map', 'arrays', 'two-pointer'],
  },

  // ── 2. Strings: Valid Parentheses (Easy) ───────────────────────────
  {
    title: 'Valid Parentheses',
    description: `Given a string \`s\` containing just the characters \`(\`, \`)\`, \`{\`, \`}\`, \`[\`, and \`]\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Print \`true\` if valid, \`false\` otherwise.`,
    difficulty: 'easy',
    domain: 'Stacks',
    constraints: '1 ≤ s.length ≤ 10^4\ns consists of parentheses only: ()[]{} ',
    inputFormat: 'A single string of brackets',
    outputFormat: 'true or false',
    sampleInput: '()',
    sampleOutput: 'true',
    testCases: [
      { input: '()', expectedOutput: 'true', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '()[]{}', expectedOutput: 'true', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '(]', expectedOutput: 'false', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '([)]', expectedOutput: 'false', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '{[]}', expectedOutput: 'true', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '', expectedOutput: 'true', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '((((', expectedOutput: 'false', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const s = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
const stack = [];
const map = { ')': '(', ']': '[', '}': '{' };
let valid = true;
for (const c of s) {
  if ('([{'.includes(c)) stack.push(c);
  else if (stack.pop() !== map[c]) { valid = false; break; }
}
console.log(valid && stack.length === 0 ? 'true' : 'false');`,
      java: `import java.util.*;
public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    String s = sc.hasNextLine() ? sc.nextLine().trim() : "";
    Stack<Character> stack = new Stack<>();
    boolean valid = true;
    for (char c : s.toCharArray()) {
      if (c == '(' || c == '[' || c == '{') stack.push(c);
      else {
        if (stack.isEmpty()) { valid = false; break; }
        char top = stack.pop();
        if ((c == ')' && top != '(') || (c == ']' && top != '[') || (c == '}' && top != '{')) { valid = false; break; }
      }
    }
    System.out.println(valid && stack.isEmpty() ? "true" : "false");
  }
}`,
      c: `#include <stdio.h>
#include <string.h>
int main() {
  char s[10001];
  if (!fgets(s, sizeof(s), stdin)) s[0] = '\\0';
  s[strcspn(s, "\\n")] = 0;
  int len = strlen(s);
  char stack[10001];
  int top = -1;
  int valid = 1;
  for (int i = 0; i < len && valid; i++) {
    if (s[i]=='('||s[i]=='['||s[i]=='{') stack[++top] = s[i];
    else {
      if (top < 0) { valid = 0; break; }
      char t = stack[top--];
      if ((s[i]==')' && t!='(') || (s[i]==']' && t!='[') || (s[i]=='}' && t!='{')) valid = 0;
    }
  }
  printf("%s\\n", (valid && top < 0) ? "true" : "false");
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  string s;
  getline(cin, s);
  stack<char> st;
  bool valid = true;
  for (char c : s) {
    if (c=='('||c=='['||c=='{') st.push(c);
    else {
      if (st.empty()) { valid=false; break; }
      char t = st.top(); st.pop();
      if ((c==')' && t!='(') || (c==']' && t!='[') || (c=='}' && t!='{')) { valid=false; break; }
    }
  }
  cout << (valid && st.empty() ? "true" : "false") << endl;
  return 0;
}`,
      kotlin: `fun main() {
  val s = readLine()?.trim() ?: ""
  val stack = ArrayDeque<Char>()
  var valid = true
  for (c in s) {
    if (c in "([{") stack.addLast(c)
    else {
      if (stack.isEmpty()) { valid = false; break }
      val t = stack.removeLast()
      if ((c==')' && t!='(') || (c==']' && t!='[') || (c=='}' && t!='{')) { valid = false; break }
    }
  }
  println(if (valid && stack.isEmpty()) "true" else "false")
}`,
      go: `package main
import (
  "bufio"
  "fmt"
  "os"
  "strings"
)
func main() {
  reader := bufio.NewReader(os.Stdin)
  s, _ := reader.ReadString('\\n')
  s = strings.TrimSpace(s)
  stack := []byte{}
  valid := true
  for i := 0; i < len(s) && valid; i++ {
    c := s[i]
    if c=='('||c=='['||c=='{' { stack = append(stack, c) } else {
      if len(stack)==0 { valid=false; break }
      t := stack[len(stack)-1]; stack = stack[:len(stack)-1]
      if (c==')' && t!='(') || (c==']' && t!='[') || (c=='}' && t!='{') { valid=false }
    }
  }
  if valid && len(stack)==0 { fmt.Println("true") } else { fmt.Println("false") }
}`,
    },
    tags: ['stack', 'string'],
  },

  // ── 3. Linked Lists: Reverse Linked List (Easy) ───────────────────
  {
    title: 'Reverse a Linked List',
    description: `Given a singly linked list represented as space-separated values, reverse it and print the reversed list.

The input is a single line of space-separated integers representing the linked list nodes in order. Output the reversed list as space-separated integers.`,
    difficulty: 'easy',
    domain: 'Linked Lists',
    constraints: '0 ≤ number of nodes ≤ 5000\n-5000 ≤ Node.val ≤ 5000',
    inputFormat: 'A single line of space-separated integers',
    outputFormat: 'A single line of space-separated integers (reversed)',
    sampleInput: '1 2 3 4 5',
    sampleOutput: '5 4 3 2 1',
    testCases: [
      { input: '1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 2', expectedOutput: '2 1', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1', expectedOutput: '1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '10 20 30 40 50 60', expectedOutput: '60 50 40 30 20 10', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '-1 0 1', expectedOutput: '1 0 -1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const input = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
const nums = input.split(' ').map(Number);
console.log(nums.reverse().join(' '));`,
      java: `import java.util.*;
public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    String[] parts = sc.nextLine().trim().split(" ");
    StringBuilder sb = new StringBuilder();
    for (int i = parts.length - 1; i >= 0; i--) {
      if (sb.length() > 0) sb.append(" ");
      sb.append(parts[i]);
    }
    System.out.println(sb.toString());
  }
}`,
      c: `#include <stdio.h>
int main() {
  int arr[5001], n = 0;
  while (scanf("%d", &arr[n]) == 1) n++;
  for (int i = n-1; i >= 0; i--) {
    if (i < n-1) printf(" ");
    printf("%d", arr[i]);
  }
  printf("\\n");
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> v;
  int x;
  while (cin >> x) v.push_back(x);
  reverse(v.begin(), v.end());
  for (int i = 0; i < v.size(); i++) {
    if (i) cout << " ";
    cout << v[i];
  }
  cout << endl;
  return 0;
}`,
      kotlin: `fun main() {
  val nums = readLine()!!.trim().split(" ").map { it.toInt() }
  println(nums.reversed().joinToString(" "))
}`,
      go: `package main
import (
  "bufio"
  "fmt"
  "os"
  "strconv"
  "strings"
)
func main() {
  reader := bufio.NewReader(os.Stdin)
  line, _ := reader.ReadString('\\n')
  parts := strings.Fields(strings.TrimSpace(line))
  for i, j := 0, len(parts)-1; i < j; i, j = i+1, j-1 {
    parts[i], parts[j] = parts[j], parts[i]
  }
  result := make([]string, len(parts))
  for i, p := range parts {
    result[i] = p
  }
  _ = strconv.Atoi // suppress unused import
  fmt.Println(strings.Join(result, " "))
}`,
    },
    tags: ['linked-list', 'in-place'],
  },

  // ── 4. Trees: Maximum Depth of Binary Tree (Easy) ─────────────────
  {
    title: 'Maximum Depth of Binary Tree',
    description: `Given a binary tree represented as a level-order traversal (with \`null\` for missing nodes), return its maximum depth.

The maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.

Input is a single line of space-separated values where \`null\` represents an absent node.`,
    difficulty: 'easy',
    domain: 'Trees',
    constraints: '0 ≤ number of nodes ≤ 10^4\n-100 ≤ Node.val ≤ 100',
    inputFormat: 'Space-separated values (integers and "null")',
    outputFormat: 'A single integer',
    sampleInput: '3 9 20 null null 15 7',
    sampleOutput: '3',
    testCases: [
      { input: '3 9 20 null null 15 7', expectedOutput: '3', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 null 2', expectedOutput: '2', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1', expectedOutput: '1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'null', expectedOutput: '0', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 2 3 4 5 null null 8', expectedOutput: '4', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const input = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
const vals = input.split(' ');
if (vals[0] === 'null' || vals.length === 0) { console.log(0); process.exit(); }
// Build tree from level-order, then DFS for depth
function maxDepth(vals) {
  if (!vals.length || vals[0] === 'null') return 0;
  const nodes = vals.map(v => v === 'null' ? null : parseInt(v));
  function depth(i) {
    if (i >= nodes.length || nodes[i] === null) return 0;
    return 1 + Math.max(depth(2*i+1), depth(2*i+2));
  }
  return depth(0);
}
console.log(maxDepth(vals));`,
      java: `import java.util.*;
public class Main {
  static String[] nodes;
  static int maxDepth(int i) {
    if (i >= nodes.length || nodes[i].equals("null")) return 0;
    return 1 + Math.max(maxDepth(2*i+1), maxDepth(2*i+2));
  }
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    nodes = sc.nextLine().trim().split(" ");
    if (nodes[0].equals("null")) { System.out.println(0); return; }
    System.out.println(maxDepth(0));
  }
}`,
      c: `#include <stdio.h>
#include <string.h>
char nodes[10001][12];
int n;
int maxDepth(int i) {
  if (i >= n || strcmp(nodes[i], "null") == 0) return 0;
  int l = maxDepth(2*i+1), r = maxDepth(2*i+2);
  return 1 + (l > r ? l : r);
}
int main() {
  char line[120000];
  fgets(line, sizeof(line), stdin);
  char *p = strtok(line, " \\n");
  n = 0;
  while (p) { strcpy(nodes[n++], p); p = strtok(NULL, " \\n"); }
  if (n == 0 || strcmp(nodes[0], "null") == 0) { printf("0\\n"); return 0; }
  printf("%d\\n", maxDepth(0));
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
vector<string> nodes;
int maxDepth(int i) {
  if (i >= (int)nodes.size() || nodes[i] == "null") return 0;
  return 1 + max(maxDepth(2*i+1), maxDepth(2*i+2));
}
int main() {
  string line; getline(cin, line);
  istringstream iss(line);
  string s;
  while (iss >> s) nodes.push_back(s);
  if (nodes.empty() || nodes[0] == "null") { cout << 0 << endl; return 0; }
  cout << maxDepth(0) << endl;
  return 0;
}`,
      kotlin: `fun main() {
  val nodes = readLine()!!.trim().split(" ")
  fun maxDepth(i: Int): Int {
    if (i >= nodes.size || nodes[i] == "null") return 0
    return 1 + maxOf(maxDepth(2*i+1), maxDepth(2*i+2))
  }
  if (nodes[0] == "null") println(0) else println(maxDepth(0))
}`,
      go: `package main
import (
  "bufio"
  "fmt"
  "os"
  "strings"
)
var nodes []string
func maxDepth(i int) int {
  if i >= len(nodes) || nodes[i] == "null" { return 0 }
  l, r := maxDepth(2*i+1), maxDepth(2*i+2)
  if l > r { return 1+l }
  return 1+r
}
func main() {
  reader := bufio.NewReader(os.Stdin)
  line, _ := reader.ReadString('\\n')
  nodes = strings.Fields(strings.TrimSpace(line))
  if len(nodes)==0 || nodes[0]=="null" { fmt.Println(0); return }
  fmt.Println(maxDepth(0))
}`,
    },
    tags: ['tree', 'recursion', 'dfs'],
  },

  // ── 5. Dynamic Programming: Climbing Stairs (Easy) ────────────────
  {
    title: 'Climbing Stairs',
    description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

Print the number of distinct ways.`,
    difficulty: 'easy',
    domain: 'Dynamic Programming',
    constraints: '1 ≤ n ≤ 45',
    inputFormat: 'A single integer n',
    outputFormat: 'A single integer',
    sampleInput: '3',
    sampleOutput: '3',
    testCases: [
      { input: '2', expectedOutput: '2', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '3', expectedOutput: '3', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1', expectedOutput: '1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '5', expectedOutput: '8', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '10', expectedOutput: '89', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '45', expectedOutput: '1836311903', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin', 'utf8').trim());
if (n <= 2) { console.log(n); } else {
  let a = 1, b = 2;
  for (let i = 3; i <= n; i++) { [a, b] = [b, a + b]; }
  console.log(b);
}`,
      java: `import java.util.*;
public class Main {
  public static void main(String[] args) {
    int n = Integer.parseInt(new Scanner(System.in).nextLine().trim());
    if (n <= 2) { System.out.println(n); return; }
    long a = 1, b = 2;
    for (int i = 3; i <= n; i++) { long t = a + b; a = b; b = t; }
    System.out.println(b);
  }
}`,
      c: `#include <stdio.h>
int main() {
  int n; scanf("%d", &n);
  if (n <= 2) { printf("%d\\n", n); return 0; }
  long long a = 1, b = 2;
  for (int i = 3; i <= n; i++) { long long t = a+b; a = b; b = t; }
  printf("%lld\\n", b);
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n; cin >> n;
  if (n <= 2) { cout << n << endl; return 0; }
  long long a = 1, b = 2;
  for (int i = 3; i <= n; i++) { long long t = a+b; a = b; b = t; }
  cout << b << endl;
  return 0;
}`,
      kotlin: `fun main() {
  val n = readLine()!!.trim().toInt()
  if (n <= 2) { println(n); return }
  var a = 1L; var b = 2L
  for (i in 3..n) { val t = a+b; a = b; b = t }
  println(b)
}`,
      go: `package main
import "fmt"
func main() {
  var n int
  fmt.Scan(&n)
  if n <= 2 { fmt.Println(n); return }
  a, b := 1, 2
  for i := 3; i <= n; i++ { a, b = b, a+b }
  fmt.Println(b)
}`,
    },
    tags: ['dynamic-programming', 'fibonacci'],
  },

  // ── 6. Graphs: Number of Islands (Medium) ─────────────────────────
  {
    title: 'Number of Islands',
    description: `Given an \`m x n\` 2D grid of \`1\`s (land) and \`0\`s (water), count the number of islands.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are surrounded by water.

**Input**: First line contains two integers m and n. Next m lines each contain n space-separated characters ('1' or '0').
**Output**: A single integer — the number of islands.`,
    difficulty: 'medium',
    domain: 'Graphs',
    constraints: '1 ≤ m, n ≤ 300\ngrid[i][j] is "0" or "1"',
    inputFormat: 'First line: m n\nNext m lines: n space-separated 0s and 1s',
    outputFormat: 'A single integer',
    sampleInput: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0',
    sampleOutput: '1',
    testCases: [
      { input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0', expectedOutput: '1', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1', expectedOutput: '3', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 1\n0', expectedOutput: '0', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 1\n1', expectedOutput: '1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '3 3\n1 0 1\n0 1 0\n1 0 1', expectedOutput: '5', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
const [m, n] = lines[0].split(' ').map(Number);
const grid = [];
for (let i = 1; i <= m; i++) grid.push(lines[i].split(' '));
function dfs(r, c) {
  if (r<0||r>=m||c<0||c>=n||grid[r][c]==='0') return;
  grid[r][c] = '0';
  dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
}
let count = 0;
for (let r = 0; r < m; r++)
  for (let c = 0; c < n; c++)
    if (grid[r][c]==='1') { count++; dfs(r,c); }
console.log(count);`,
      java: `import java.util.*;
public class Main {
  static char[][] grid;
  static int m, n;
  static void dfs(int r, int c) {
    if (r<0||r>=m||c<0||c>=n||grid[r][c]=='0') return;
    grid[r][c]='0';
    dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
  }
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    m = sc.nextInt(); n = sc.nextInt(); sc.nextLine();
    grid = new char[m][n];
    for (int i = 0; i < m; i++) {
      String[] parts = sc.nextLine().trim().split(" ");
      for (int j = 0; j < n; j++) grid[i][j] = parts[j].charAt(0);
    }
    int count = 0;
    for (int r=0;r<m;r++) for (int c=0;c<n;c++)
      if (grid[r][c]=='1') { count++; dfs(r,c); }
    System.out.println(count);
  }
}`,
      c: `#include <stdio.h>
int m, n;
char grid[301][301];
void dfs(int r, int c) {
  if (r<0||r>=m||c<0||c>=n||grid[r][c]=='0') return;
  grid[r][c]='0';
  dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
}
int main() {
  scanf("%d %d", &m, &n);
  for (int i=0;i<m;i++) for (int j=0;j<n;j++) { char s[4]; scanf("%s", s); grid[i][j]=s[0]; }
  int count=0;
  for (int r=0;r<m;r++) for (int c=0;c<n;c++) if (grid[r][c]=='1') { count++; dfs(r,c); }
  printf("%d\\n", count);
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int m, n;
vector<vector<char>> grid;
void dfs(int r, int c) {
  if (r<0||r>=m||c<0||c>=n||grid[r][c]=='0') return;
  grid[r][c]='0';
  dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
}
int main() {
  cin >> m >> n;
  grid.assign(m, vector<char>(n));
  for (int i=0;i<m;i++) for (int j=0;j<n;j++) cin >> grid[i][j];
  int count = 0;
  for (int r=0;r<m;r++) for (int c=0;c<n;c++) if (grid[r][c]=='1') { count++; dfs(r,c); }
  cout << count << endl;
  return 0;
}`,
      kotlin: `lateinit var grid: Array<CharArray>
var m = 0; var n = 0
fun dfs(r: Int, c: Int) {
  if (r<0||r>=m||c<0||c>=n||grid[r][c]=='0') return
  grid[r][c]='0'
  dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)
}
fun main() {
  val (mm, nn) = readLine()!!.trim().split(" ").map { it.toInt() }
  m = mm; n = nn
  grid = Array(m) { readLine()!!.trim().split(" ").map { it[0] }.toCharArray() }
  var count = 0
  for (r in 0 until m) for (c in 0 until n) if (grid[r][c]=='1') { count++; dfs(r,c) }
  println(count)
}`,
      go: `package main
import "fmt"
var grid [][]byte
var m, n int
func dfs(r, c int) {
  if r<0||r>=m||c<0||c>=n||grid[r][c]=='0' { return }
  grid[r][c]='0'
  dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)
}
func main() {
  fmt.Scan(&m, &n)
  grid = make([][]byte, m)
  for i := 0; i < m; i++ {
    grid[i] = make([]byte, n)
    for j := 0; j < n; j++ { var s string; fmt.Scan(&s); grid[i][j] = s[0] }
  }
  count := 0
  for r := 0; r < m; r++ { for c := 0; c < n; c++ { if grid[r][c]=='1' { count++; dfs(r,c) } } }
  fmt.Println(count)
}`,
    },
    tags: ['graph', 'dfs', 'bfs', 'matrix'],
  },

  // ── 7. Sorting: Merge Sort (Medium) ───────────────────────────────
  {
    title: 'Merge Sort Implementation',
    description: `Implement **Merge Sort** to sort an array of integers in ascending order.

Given an array of integers, sort it using the merge sort algorithm and print the sorted array.`,
    difficulty: 'medium',
    domain: 'Sorting',
    constraints: '1 ≤ n ≤ 10^5\n-10^9 ≤ arr[i] ≤ 10^9',
    inputFormat: 'A single line of space-separated integers',
    outputFormat: 'A single line of space-separated integers (sorted)',
    sampleInput: '5 2 8 1 9',
    sampleOutput: '1 2 5 8 9',
    testCases: [
      { input: '5 2 8 1 9', expectedOutput: '1 2 5 8 9', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '3 1 2', expectedOutput: '1 2 3', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1', expectedOutput: '1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '5 4 3 2 1', expectedOutput: '1 2 3 4 5', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '1 1 1 1', expectedOutput: '1 1 1 1', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: '-3 0 -1 5 2', expectedOutput: '-3 -1 0 2 5', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const arr = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split(' ').map(Number);
function mergeSort(a) {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length/2);
  const l = mergeSort(a.slice(0,mid)), r = mergeSort(a.slice(mid));
  const res = []; let i=0,j=0;
  while (i<l.length && j<r.length) res.push(l[i]<r[j]?l[i++]:r[j++]);
  return res.concat(l.slice(i)).concat(r.slice(j));
}
console.log(mergeSort(arr).join(' '));`,
      java: `import java.util.*;
public class Main {
  static void merge(int[] a, int l, int m, int r) {
    int[] L = Arrays.copyOfRange(a,l,m+1), R = Arrays.copyOfRange(a,m+1,r+1);
    int i=0,j=0,k=l;
    while(i<L.length&&j<R.length) a[k++]=L[i]<R[j]?L[i++]:R[j++];
    while(i<L.length) a[k++]=L[i++];
    while(j<R.length) a[k++]=R[j++];
  }
  static void mergeSort(int[] a, int l, int r) {
    if(l<r) { int m=(l+r)/2; mergeSort(a,l,m); mergeSort(a,m+1,r); merge(a,l,m,r); }
  }
  public static void main(String[] args) {
    String[] p = new Scanner(System.in).nextLine().trim().split(" ");
    int[] a = new int[p.length];
    for(int i=0;i<p.length;i++) a[i]=Integer.parseInt(p[i]);
    mergeSort(a,0,a.length-1);
    StringBuilder sb=new StringBuilder();
    for(int i=0;i<a.length;i++){if(i>0)sb.append(' ');sb.append(a[i]);}
    System.out.println(sb);
  }
}`,
      c: `#include <stdio.h>
#include <stdlib.h>
void merge(int*a,int l,int m,int r){
  int n1=m-l+1,n2=r-m;
  int*L=malloc(n1*sizeof(int)),*R=malloc(n2*sizeof(int));
  for(int i=0;i<n1;i++)L[i]=a[l+i];
  for(int j=0;j<n2;j++)R[j]=a[m+1+j];
  int i=0,j=0,k=l;
  while(i<n1&&j<n2)a[k++]=L[i]<R[j]?L[i++]:R[j++];
  while(i<n1)a[k++]=L[i++];while(j<n2)a[k++]=R[j++];
  free(L);free(R);
}
void mergeSort(int*a,int l,int r){if(l<r){int m=(l+r)/2;mergeSort(a,l,m);mergeSort(a,m+1,r);merge(a,l,m,r);}}
int main(){
  int a[100001],n=0;
  while(scanf("%d",&a[n])==1)n++;
  mergeSort(a,0,n-1);
  for(int i=0;i<n;i++){if(i)printf(" ");printf("%d",a[i]);}
  printf("\\n");return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
void mergeSort(vector<int>&a,int l,int r){
  if(l>=r) return;
  int m=(l+r)/2;
  mergeSort(a,l,m); mergeSort(a,m+1,r);
  vector<int> tmp;
  int i=l,j=m+1;
  while(i<=m&&j<=r) tmp.push_back(a[i]<a[j]?a[i++]:a[j++]);
  while(i<=m) tmp.push_back(a[i++]);
  while(j<=r) tmp.push_back(a[j++]);
  for(int k=0;k<(int)tmp.size();k++) a[l+k]=tmp[k];
}
int main(){
  vector<int> a; int x;
  while(cin>>x) a.push_back(x);
  mergeSort(a,0,a.size()-1);
  for(int i=0;i<(int)a.size();i++){if(i)cout<<' ';cout<<a[i];}
  cout<<endl; return 0;
}`,
      kotlin: `fun mergeSort(a: IntArray, l: Int, r: Int) {
  if (l >= r) return
  val m = (l+r)/2
  mergeSort(a, l, m); mergeSort(a, m+1, r)
  val tmp = IntArray(r-l+1); var i=l; var j=m+1; var k=0
  while(i<=m && j<=r) { tmp[k++]=if(a[i]<a[j]) a[i++] else a[j++] }
  while(i<=m) tmp[k++]=a[i++]; while(j<=r) tmp[k++]=a[j++]
  for(x in tmp.indices) a[l+x]=tmp[x]
}
fun main() {
  val a = readLine()!!.trim().split(" ").map{it.toInt()}.toIntArray()
  mergeSort(a, 0, a.size-1)
  println(a.joinToString(" "))
}`,
      go: `package main
import(
  "bufio";"fmt";"os";"strconv";"strings"
)
func mergeSort(a []int) []int {
  if len(a)<=1 { return a }
  m:=len(a)/2
  l,r:=mergeSort(a[:m]),mergeSort(a[m:])
  res:=make([]int,0,len(a)); i,j:=0,0
  for i<len(l)&&j<len(r) { if l[i]<r[j]{res=append(res,l[i]);i++}else{res=append(res,r[j]);j++} }
  res=append(res,l[i:]...); res=append(res,r[j:]...)
  return res
}
func main() {
  reader:=bufio.NewReader(os.Stdin)
  line,_:=reader.ReadString('\\n')
  parts:=strings.Fields(strings.TrimSpace(line))
  a:=make([]int,len(parts))
  for i,p:=range parts { a[i],_=strconv.Atoi(p) }
  a=mergeSort(a)
  ss:=make([]string,len(a))
  for i,v:=range a { ss[i]=strconv.Itoa(v) }
  fmt.Println(strings.Join(ss," "))
}`,
    },
    tags: ['sorting', 'divide-and-conquer', 'merge-sort'],
  },

  // ── 8. Strings: Longest Palindromic Substring (Medium) ────────────
  {
    title: 'Longest Palindromic Substring',
    description: `Given a string \`s\`, return the **longest palindromic substring** in \`s\`.

If there are multiple answers of the same length, return the first one found.`,
    difficulty: 'medium',
    domain: 'Strings',
    constraints: '1 ≤ s.length ≤ 1000\ns consists of only digits and English letters',
    inputFormat: 'A single string',
    outputFormat: 'A single string (the longest palindromic substring)',
    sampleInput: 'babad',
    sampleOutput: 'bab',
    testCases: [
      { input: 'babad', expectedOutput: 'bab', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'cbbd', expectedOutput: 'bb', isHidden: false, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'a', expectedOutput: 'a', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'ac', expectedOutput: 'a', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'racecar', expectedOutput: 'racecar', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
      { input: 'aacabdkacaa', expectedOutput: 'aca', isHidden: true, timeLimit: 2000, memoryLimit: 262144 },
    ],
    starterCode: {
      javascript: `const s = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
let start=0, maxLen=1;
function expand(l, r) {
  while(l>=0 && r<s.length && s[l]===s[r]) { l--; r++; }
  if(r-l-1 > maxLen) { start=l+1; maxLen=r-l-1; }
}
for(let i=0;i<s.length;i++) { expand(i,i); expand(i,i+1); }
console.log(s.substring(start, start+maxLen));`,
      java: `import java.util.*;
public class Main {
  static String s;
  static int start=0, maxLen=1;
  static void expand(int l, int r) {
    while(l>=0 && r<s.length() && s.charAt(l)==s.charAt(r)){l--;r++;}
    if(r-l-1>maxLen){start=l+1;maxLen=r-l-1;}
  }
  public static void main(String[] args) {
    s = new Scanner(System.in).nextLine().trim();
    for(int i=0;i<s.length();i++){expand(i,i);expand(i,i+1);}
    System.out.println(s.substring(start,start+maxLen));
  }
}`,
      c: `#include <stdio.h>
#include <string.h>
char s[1001];
int st=0, ml=1;
void expand(int l, int r, int n) {
  while(l>=0 && r<n && s[l]==s[r]){l--;r++;}
  if(r-l-1>ml){st=l+1;ml=r-l-1;}
}
int main() {
  fgets(s,sizeof(s),stdin); s[strcspn(s,"\\n")]=0;
  int n=strlen(s);
  for(int i=0;i<n;i++){expand(i,i,n);expand(i,i+1,n);}
  for(int i=st;i<st+ml;i++) putchar(s[i]);
  putchar('\\n');
  return 0;
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  string s; getline(cin, s);
  int n=s.size(),st=0,ml=1;
  auto expand=[&](int l,int r){
    while(l>=0&&r<n&&s[l]==s[r]){l--;r++;}
    if(r-l-1>ml){st=l+1;ml=r-l-1;}
  };
  for(int i=0;i<n;i++){expand(i,i);expand(i,i+1);}
  cout<<s.substr(st,ml)<<endl;
  return 0;
}`,
      kotlin: `fun main() {
  val s = readLine()!!.trim()
  var st = 0; var ml = 1
  fun expand(l0: Int, r0: Int) {
    var l=l0; var r=r0
    while(l>=0 && r<s.length && s[l]==s[r]){l--;r++}
    if(r-l-1>ml){st=l+1;ml=r-l-1}
  }
  for(i in s.indices){expand(i,i);expand(i,i+1)}
  println(s.substring(st, st+ml))
}`,
      go: `package main
import(
  "bufio";"fmt";"os";"strings"
)
func main() {
  reader:=bufio.NewReader(os.Stdin)
  s,_:=reader.ReadString('\\n')
  s=strings.TrimSpace(s)
  n:=len(s); st,ml:=0,1
  expand:=func(l,r int){
    for l>=0&&r<n&&s[l]==s[r]{l--;r++}
    if r-l-1>ml{st=l+1;ml=r-l-1}
  }
  for i:=0;i<n;i++{expand(i,i);expand(i,i+1)}
  fmt.Println(s[st:st+ml])
}`,
    },
    tags: ['string', 'dynamic-programming', 'expand-around-center'],
  },
];

/**
 * Seed system DSA questions into the database.
 * Uses upsert to prevent duplicates on re-runs.
 */
async function seedDsaQuestions() {
  let created = 0;
  let skipped = 0;

  for (const q of SYSTEM_QUESTIONS) {
    try {
      const existing = await DsaQuestion.findOne({
        title: q.title,
        source: 'system',
        jobPostingId: null,
      });

      if (existing) {
        skipped++;
        continue;
      }

      await DsaQuestion.create({
        ...q,
        source: 'system',
        jobPostingId: null,
      });
      created++;
    } catch (err) {
      if (err.code !== 11000) {
        logger.warn(`Failed to seed DSA question: ${q.title}`, { err: err.message });
      }
    }
  }

  logger.info(`DSA questions seeded: ${created} created, ${skipped} already existed`);
}

module.exports = { seedDsaQuestions };
