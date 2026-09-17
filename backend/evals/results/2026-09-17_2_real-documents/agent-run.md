# Golden set run

- Mode: `agent`
- Started: 2026-09-17T06:52:29.557266+00:00
- Workspace: Real Document Eval
- Corpus: 10 documents, 424 passages
- Answer model configured: `gemini-3.5-flash`

Fill in `grading` in the JSON file: `answer_correct` as `true`, `false` or `"partial"`, and `citation_acceptable` as `true` only when the model cited a different passage that genuinely supports the answer.

---

## Q01 · paraphrased_lookup · `lookup`

**Q.** How well does the custom-built neural network spot tea leaf diseases, compared with the transfer-learning model used in the same study?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 15
> overall accuracy of 94% in classifying tea leaf diseases

**Expected answer.** The custom CNN built from scratch reached 94% overall accuracy, beating the ResNet50V2 transfer-learning model in the same study, which reached 84% accuracy.

**Answer** (gemini-3.5-flash, 26.6s)

The custom-built convolutional neural network model achieved the highest overall accuracy of 94% in classifying tea leaf diseases [1]. In comparison, the transfer-learning model based on the ResNet50V2 architecture achieved an accuracy of 84% [1][2]. This positioned the transfer-learning model as the second-best performer in the study [2].

**Cited 2 passage(s):**

- **[1]** `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  chars 23080–25923 ← expected
  > information on the screen by displaying the disease name, MobileNetV2. Additionally, the impact of different optimizers reasons, symptoms, and remedies. (Adam, RMSprop, Adamax) and data augmentation techniques was also investigated, and among the optimizers, Adamax VI. RESULTS AND DISCUSSION demonstrated the best performance across multiple models. The performance of the tea leaf disease classiﬁcation model The CNN model built from scratch achieved the highest was evaluated using the accuracy metrics, accuracy (1), preoverall accuracy of 94% in classifying tea leaf diseases. cision (2), recall (3), and F1-score (4). The model achieved The Adamax optimizer consistently yielded better results, an overall accuracy of 94% in classifying the seven disease and data augmentation improved the mode

- **[2]** `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  chars 25925–28198
  > |o|of accuracy but|t also ex|xcels in classifying a larger number|Col5|Col6|Col7| |---|---|---|---|---|---|---| |o|f accuracy but|also ex|cels in classifying a larger number|[6]|C.-C.<br>Yang,<br>S.<br>O.<br>Prasher,<br>P.<br>Enright,<br>C.<br>Madram|ootoo,| |o|f tea leaf disea|se class|es, thereby offering a more effective||M.<br>Burgess,<br>P.<br>K.<br>Goel,<br>and<br>I.<br>Callum,<br>“Appl<br><br><br><br><br><br><br>|ication<br>| ||<br>|<br>|<br>||of<br>decision<br>tree<br>technology<br>for<br>image<br>classiﬁcation|using| |s<br>|olution. Refer t<br>|Table I|for the comparison among the SOTA||remote<br>sensing<br>data,”<br>_Agricultural_<br>_Systems_,<br>vol.<br>76,<br>|o.<br>3,| |m|ethods.||||pp.<br>1101–1117,<br>2003,<br>publisher:<br>Elsevier.<br>[Online].<br>Av|ailable:| ||||||https

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q02 · paraphrased_lookup · `lookup`

**Q.** How does PowerProx decide what each person using the system is allowed to do?

**Expected passage.** SLT_PowerProx_solution_architecture.docx, passage 17
> PowerProx uses a Role-Based Access Control (RBAC) approach to manage user permissions. Each user is assigned an access level or role that determines the modules, functions, and actions available to that user.

**Expected answer.** Through Role-Based Access Control (RBAC): every user is assigned an access level or role (e.g. Administrator, Engineer/Technical User, Technician, Approving Officer/Manager, Viewer/Read-Only User) and that role determines which modules, functions and actions they can use.

**Answer** (gemini-3.5-flash, 20.2s)

PowerProx determines user permissions using a Role-Based Access Control (RBAC) approach [1]. Under this model, each user is assigned a specific access level or role based on their operational responsibilities [1][2]. This assigned role directly dictates the modules, functions, and actions that the user is permitted to access and perform within the system [1][2]. For example, higher-privilege roles are allowed to perform administrative, approval, or update activities, whereas lower-privilege roles are restricted to operational or view-only functions [1].

**Cited 2 passage(s):**

- **[1]** `SLT PowerProx solution architecture.docx` Security & Access Control > Access Control Model chars 10642–11016 ← expected
  > PowerProx uses a Role-Based Access Control (RBAC) approach to manage user permissions. Each user is assigned an access level or role that determines the modules, functions, and actions available to that user. Higher-privilege roles may perform administrative, approval, or update activities, while lower-privilege roles may be limited to operational or view-only functions.

- **[2]** `SLT PowerProx solution architecture.docx` Security & Access Control > Overview chars 10099–10618
  > The PowerProx security architecture is designed to ensure that users can access only the functions and information relevant to their assigned responsibilities. Security controls are applied across the application to protect operational data, restrict unauthorized actions, and support accountability for changes made within the system. Access to PowerProx functions is managed through role-based authorization, where user permissions are determined according to assigned access levels and operational responsibilities.

**Auto:** correct passage cited · retrieved at rank 4 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q03 · paraphrased_lookup · `lookup`

**Q.** In the SmartSmile app, how long does the phone have to come back with a result after someone scans an X-ray?

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 17
> FR3.5: The system shall complete inference within 5 seconds on target devices.

**Expected answer.** Within 5 seconds.

**Answer** (gemini-3.5-flash, 21.6s)

In the SmartSmile app, the system must complete the on-device inference within 5 seconds on target devices [1].

**Cited 1 passage(s):**

- **[1]** `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR3: On-Device Inference chars 13055–13519 ← expected
  > ●​ FR3.1: The system shall perform preprocessing of dental X-ray images for model compatibility. ●​ FR3.2: The system shall execute the dental scan detection model (YOLOv10) locally on the device. ●​ FR3.3: The system shall generate bounding boxes around detected dental issues within the X-ray image. ●​ FR3.4: The system shall calculate a confidence score for each detected issue. ●​ FR3.5: The system shall complete inference within 5 seconds on target devices.

**Auto:** correct passage cited · retrieved at rank 2 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q04 · exact_term · `lookup`

**Q.** What is the name of the API endpoint that handles CV ranking requests in the CV Filtering System?

**Expected passage.** CV_Filtering_System_AI_.docx, passage 0
> API Endpoint (/rank_cvs) Receives filtering request with custom prompt

**Expected answer.** /rank_cvs

**Answer** (gemini-3.5-flash, 19.8s)

The API endpoint that handles CV ranking requests in the CV Filtering System is /rank_cvs [1].

**Cited 1 passage(s):**

- **[1]** `CV Filtering System AI .docx`  chars 0–1800 ← expected
  > CV Filtering System: Step-by-Step Process CV filtering system is designed to rank candidate CVs based on their relevance to a specific job requirement prompt. Overall Process Flow CV Processing & Storage PDFs are converted to images OCR extracts text from images Extracted text is stored in database Keywords are matched to identify possible job roles Query Handling User submits a prompt describing desired candidate qualities System retrieves previously processed CV data Text embeddings are generated for comparison Ranking & Results Semantic similarity is calculated between prompt and CVs CVs are ranked by similarity score Top candidates are returned with relevant information Detailed Components Explanation 1. CV Processing Pipeline PDF Conversion: Uses pdf2image library to

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q05 · exact_term · `lookup`

**Q.** Which port number does MySQL use in Server B's firewall rule in the SLT server migration proposal?

**Expected passage.** SLT_Server_Migration_Proposal.docx, passage 14
> Server B (database tier) is firewalled to accept traffic only from Server A, and only on database ports (5432 for PostgreSQL, 3306 for MySQL)

**Expected answer.** 3306

**Answer** (gemini-3.5-flash, 20.0s)

In the SLT server migration proposal, MySQL uses port number 3306 in Server B's firewall rule [1].

**Cited 1 passage(s):**

- **[1]** `SLT_Server_Migration_Proposal.docx` 7. Security Considerations chars 5832–6211 ← expected
  > Server B (database tier) is firewalled to accept traffic only from Server A, and only on database ports (5432 for PostgreSQL, 3306 for MySQL) SSL/TLS termination handled at Nginx on Server A Environment variables / connection strings kept out of source control and managed via a secrets file or environment manager Regular OS and dependency patching scheduled for both servers

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q06 · table · `lookup`

**Q.** In the GreenGuard classification report (Table I), what F1-score and support count did the 'Gray light' disease class get?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 12
> Gray light 0.96 1.00 0.98 23

**Expected answer.** F1-score 0.98, with a support (sample count) of 23.

**Answer** (gemini-3.5-flash, 20.1s)

In the GreenGuard classification report, the 'Gray light' disease class achieved an F1-score of 0.98 [1]. The support count for the 'Gray light' disease class in the report is 23 [1].

**Cited 1 passage(s):**

- **[1]** `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  chars 18692–19101 ← expected
  > |Col1|Precision|Recall|F1-score|Support| |---|---|---|---|---| |Anthracnose|0.94|0.79|0.86|19| |Algal leaf|1.00|0.94|0.97|17| |Bird eye spot|0.81|0.93|0.87|14| |Brown blight|0.93|0.93|0.93|15| |Gray light|0.96|1.00|0.98|23| |Red leaf spot|1.00|0.93|0.97|15| |White spot|0.90|1.00|0.95|19| |Healthy|1.00|1.00|1.00|6| |||||| |Accuracy|||0.94|128| |Macro avg|0.94|0.94|0.94|128| |Weighted avg|0.94|0.94|0.94|128|

**Auto:** correct passage cited · retrieved at rank 4 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q07 · table · `lookup`

**Q.** How much RAM is proposed for Server B (the database server) in the starting sizing allocation of the SLT server migration proposal?

**Expected passage.** SLT_Server_Migration_Proposal.docx, passage 9
> | Server B (Database) | 2 | 4-8 GB | SSD (priority) | Postgres + MySQL, separate data volumes if possible |

**Expected answer.** 4-8 GB.

**Answer** (gemini-3.5-flash, 22.7s)

In the starting sizing allocation of the SLT server migration proposal, Server B (the database server) is proposed to have 4–8 GB of RAM [1].

**Cited 1 passage(s):**

- **[1]** `SLT_Server_Migration_Proposal.docx` 5. Server Sizing (Starting Allocation) chars 3883–4163 ← expected
  > | Server | vCPU | RAM | Storage | Notes | | --- | --- | --- | --- | --- | | Server A (Web/App) | 2 | 4 GB | Standard SSD | Static files + 3 lightweight FastAPI containers | | Server B (Database) | 2 | 4–8 GB | SSD (priority) | Postgres + MySQL, separate data volumes if possible |

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q08 · multi_passage · `explore`

**Q.** In CM4607, which fitness-function component was given the highest weight, and does the GA's actual final result reflect that priority?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 39, 68
> w1 = 100 (High): Primary objective. Waiting time directly impacts user experience and is the most critical metric in traffic engineering.

**Expected answer.** Average waiting time (Wavg) has the highest weight, w1 = 100, described as the 'Primary objective' in the weight-justification section. The final result reflects that priority: the GA achieved a 51.3% reduction in average waiting time, and the discussion explicitly accepts a slightly worse maximum queue (14 to 15 vehicles) as 'an acceptable trade-off' for that waiting-time gain.

**Answer** (gemini-3.5-flash, 32.9s)

In CM4607, the fitness-function component given the highest weight was waiting time, which was assigned a weight coefficient of 100 [1]. The genetic algorithm's actual final result reflects this priority, as it achieved a 51% improvement in average waiting time [2].

**Cited 2 passage(s):**

- **[1]** `CM4607 Esandu Report.pdf` Methodology > Fitness Function > Weight Justification chars 22373–23229 ← expected
  > The weight coefficients were selected based on traffic engineering priorities: • w1 = 100 (High): Primary objective. Waiting time directly impacts user experience and is the most critical metric in traffic engineering. • w2 = 20 (Medium): Secondary indicator. Queue length correlates with delay but adds spatial dimension (congestion location). • w3 = 10 (Low-Medium): Worst-case prevention. Avoids extreme scenarios without over-prioritizing rare events. • w4 = 0.5 (Low): Reward component. Encourages efficient vehicle movement without dominating the objective. The weighted sum approach transforms the multi-objective problem into a single scalar fitness, allowing standard GA optimization while maintaining interpretability. The weight ratios (100:20:10:0.5) reflect the relative importance hiera

- **[2]** `CM4607 Esandu Report.pdf` Results and Discussion > Analysis and Discussion > Multi-Objective Balance: The GA successfully balanced competing objectives, prior- chars 31887–32062 ← expected
  > itizing average metrics over worst-case (maximum queue increased marginally from 14 to 15 vehicles, an acceptable trade-off given the 51% improvement in average waiting time).

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q09 · multi_passage · `explore`

**Q.** Of the 250 posts used as the manually annotated sentiment test set in the NLP coursework report, how many did Esandu actually label himself versus have an LLM label?

**Expected passage.** NLP_CWReport_2237041.pdf, passage 6, 9
> I randomly selected 250 posts for manual annotation as the test set.

**Expected answer.** He personally annotated 50 of the 250 posts, then had Gemini label the other 200 after checking that Gemini's labels matched his own 50.

**Answer** (gemini-3.5-flash, 25.3s)

The provided workspace documents do not contain information on how many of the 250 manually annotated posts Esandu labeled himself versus how many were labeled by an LLM.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank 3 · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

---

## Q10 · cross_doc · `explore`

**Q.** Esandu's individual CM4607 report says the GA achieved a 51.3% reduction in average waiting time versus baseline. How does that compare to the improvement DQN achieved over fixed-time control in the medium-traffic scenario reviewed in the group's RL literature review (rt-grp-1-report)?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 65, 78
> 51.3% reduction in average waiting time

**Expected answer.** They are in the same ballpark: CM4607's own GA cut average waiting time by 51.3% versus baseline. In the group report's review of Mousavi et al.'s medium-traffic scenario (Table 4), DQN and DDPG achieved a 47-49% reduction in waiting time versus fixed-time control (94.8s/91.5s vs a 180.2s baseline). So Esandu's own GA result slightly exceeds the DQN figure reported in the literature review.

**Answer** (gemini-3.5-flash, 21.0s)

The provided workspace documents do not contain information to compare the DQN's improvement over fixed-time control in a medium-traffic scenario with the 51.3% reduction achieved by the GA.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank 1 · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

---

## Q11 · lookalike_trap · `lookup`

**Q.** In the GreenGuard paper's SOTA comparison table (Table II), what accuracy figure is reported for Xie et al.'s Swin-Transformer-based method on the Chaozhou Dancong tea dataset?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 14
> Xie et al. [1] Chaozhou Dancong Tea dataset (Self-made dataset) 5 Swim Transformer depth learning algorithm with migration learning

**Expected answer.** 94% (reported as 'Detection accuracy').

**Answer** (gemini-3-flash-preview, 37.6s)

In the SOTA comparison table (Table II) of the GreenGuard paper, the method by Xie et al. is reported to have a detection accuracy of 94% [1]. This method utilized a Swin Transformer (referred to as "Swim Transformer" in the document) deep learning algorithm with migration learning [1]. The study focused on five disease classes using a self-made Chaozhou Dancong tea dataset [1].

**Cited 1 passage(s):**

- **[1]** `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  chars 21611–23078 ← expected
  > |Author|Dataset|Number<br>of<br>disease<br>classes|Method|Accuracy Metrics|Accuracy| |---|---|---|---|---|---| |Singh et al. [7]|900 high resolution im-<br>ages|7|Convolutional 2D model|Precision,<br>Recall,<br>F1-<br>score|Classiﬁcation<br>accuracy-<br>84.5%| |Divya Praba et al.<br>[8]|UAV dataset|7|GoogLeNet, InceptionV3,<br>ResNet 110, SVM|Accuracy|_•_ GoogLeNet - 85%<br>_•_ InceptionV3 - 75%<br>_•_ ResNet110 - 73%<br>_•_ SVM - 73%| |Xie et al. [1]|Chaozhou<br>Dancong<br>Tea<br>dataset<br>(Self-made<br>dataset)|5|Swim Transformer depth<br>learning<br>algorithm<br>with<br>migration learning|Precision, Recall, Speci-<br>ﬁcity|Detection accuracy - 94%| |Zhou et al. [15]|Oil<br>tea<br>Camellia<br>Tea<br>dataset(Self-made dataset)<br>captured using a Huawei<br>nova7 smartphone|7|Improved<br>

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---

## Q12 · lookalike_trap · `lookup`

**Q.** According to the CM4608 feedback grid (the grading table, not the main task description), what subset size must an Excellent (Grade A) Task 1 submission clearly identify through EDA?

**Expected passage.** CM4608_Assessment_Brief_Coursework.pdf, passage 13
> Collected a large dataset from which a diverse subset of at least 15,000 was clearly identified using carefully selected informative exploratory data analysis.

**Expected answer.** At least 15,000 - this is a different figure from the 50,000-entry minimum raw collection required in the main task description earlier in the same brief.

**Answer** (gemini-3-flash-preview, 32.8s)

For an Excellent Grade A in Task 1, a submission must clearly identify a diverse subset of at least 15,000 entries [1]. This subset must be identified using carefully selected and informative exploratory data analysis [1].

**Cited 1 passage(s):**

- **[1]** `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Feedback grid chars 36152–37080 ← expected
  > |GRADE|A|B|C|D|E|F| |---|---|---|---|---|---|---| |**DEFINITION**<br>**CRITERIA**<br>**(WEIGHTING**|** /**<br>**)**<br>**EXCELLENT**<br>Outstanding<br>Performance|**COMMENDABLE/VERY GOOD**<br>Meritorious<br>Performance|<br>**GOOD**<br>Highly Competent<br>Performance|**SATISFACTORY**<br>Competent<br>Performance|**BORDERLINE FAIL**|**UNSATISFACTORY**<br>Fail| |**Task 1**<br>**(1 subgrade**|** )**<br>Collected a large dataset<br>from which a diverse<br>subset of at least 15,000<br>was clearly identified<br>using carefully selected<br>informative exploratory<br>data analysis.|||||| |**Task 2**<br>**(1 subgrade**|** )**<br>Employed appropriate<br>tools and techniques to<br>clean and pre-process the<br>data and then applied 3<br>well justified tokenization<br>schemes to the data; used<br>intrins

**Auto:** correct passage cited · retrieved at rank 3 · confidence None (uncalibrated) · grounded True · flagged False

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---

## Q13 · conflicting_versions · `lookup`

**Q.** What crossover probability did the GA in CM4607 use?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 54, 59
> The crossover probability of 75% ensures that 25% of individuals pass to the next generation unchanged

**Expected answer.** The document actually gives two different figures for this. The two-point crossover operator is formally defined with Pc = 0.7 (70%), but the justification paragraph right after it, and the Table 4 methodology summary, both state 75% instead. A careful answer should flag this inconsistency and give both values, noting that 75% is the one repeated twice (justification text + summary table) versus 70% stated once (the formal definition).

**Answer** (gemini-3.5-flash-lite, 16.5s)

The genetic algorithm applied two-point crossover with a probability of 0.7 (70%) [1].

**Cited 1 passage(s):**

- **[1]** `CM4607 Esandu Report.pdf` Methodology > Genetic Operators > Crossover: Two-Point Crossover chars 26921–28045 ← expected
  > Two-point crossover was applied with probability Pc = 0.7 (70%) to create offspring from selected parents. The operator randomly selects two crossover points within the chromosome, then exchanges the genetic material between these points. Mechanism: [g1, g2 | g3, g4, g5 | g6, g7, g8] Parent 1: [h1, h2 | h3, h4, h5 | h6, h7, h8] Parent 2: (21) [g1, g2 | h3, h4, h5 | g6, g7, g8] Offspring 1: [h1, h2 | g3, g4, g5 | h6, h7, h8] Offspring 2: where the vertical bars (|) indicate the two randomly selected crossover points. Justification: Two-point crossover preserves building blocks - clusters of genes that work well together . For example, signal timings for a single intersection ([gNS , gEW ]) may exhibit strong i i correlation; two-point crossover can preserve these pairs as units while still

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded False · flagged True (groundedness_failed)

**Note:** answered by `gemini-3.5-flash-lite`, a fallback, not the configured answer model.

---

## Q14 · summary · `summarize`

**Q.** Summarise how SmartSmile's model-retraining pipeline works, from a low-confidence X-ray detection to an updated model reaching users' phones.

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 25, 28
> A nightly Lambda job syncs these to a training dataset.

**Expected answer.** A detection below the confidence threshold is flagged and the image is uploaded to S3 via a Lambda function. A dentist reviews and annotates it in Label Studio (hosted on Elastic Beanstalk). A nightly Lambda job syncs the new annotations back to S3 as training data. Once enough new labelled samples exist, an AWS EventBridge-triggered Lambda kicks off a SageMaker notebook that fine-tunes the YOLOv10 model and validates its performance. The updated model is then deployed and distributed to end devices in a future app version.

**Answer** (gemini-3.5-flash, 16.2s)

When the local YOLOv10 model on the app detects an X-ray with low confidence (under 50%), the original image is flagged for expert review and uploaded to S3 via Lambda [1]. Dentists then log into Label Studio to draw annotations and save them to S3, which are synced to a training dataset by a nightly Lambda job [1]. The system incorporates this expert-labeled data and triggers automated model retraining when 300 new labeled samples are available [1][2]. This retraining process is orchestrated using AWS Event Bridge, Lambda Functions, SageMaker, and S3 [1]. Once the new model's performance is evaluated against established metrics, improved models are automatically deployed to production and distributed to end devices [2].

**Cited 2 passage(s):**

- **[1]** `Group 27 - report - SmartSmile edgeAI.pdf` System Architecture & Design > Workflow Sequence chars 18287–19059 ← expected
  > 1.​ User Upload & Inference a.​ The app preprocesses the X-ray and runs YOLOv10 locally. b.​ Confidence Check: i.​ High (≥50%): Annotated image shown immediately. ii.​ Low (<50%): Original image flagged for expert review. 2.​ Cloud Processing a.​ Images are uploaded to S3 via Lambda, with file data (user ID, timestamp, confidence scores) stored in S3. 3.​ Expert Feedback Loop a.​ Dentists log into Label Studio, draw annotations, and save them to S3. b.​ A nightly Lambda job syncs these to a training dataset. 4.​ Periodic Retraining a.​ Retraining is automated using AWS Event Bridge triggering Lambda Functions to orchestrate Lambda, SageMaker, and S3. 5.​ User History a.​ Users have the ability to check their previous uploads with the model output for each image.

- **[2]** `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR7: Model Retraining chars 14864–15284
  > ●​ FR7.1: The system shall trigger model retraining when 300 new labeled samples are available ●​ FR7.2: The system shall incorporate expert-labeled data into training datasets ●​ FR7.3: The system shall evaluate new model performance against established metrics ●​ FR7.4: The system shall deploy improved models to production automatically ●​ FR7.5: The system shall distribute updated models to end devices efficiently

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

---

## Q15 · vague_wording · `lookup`

**Q.** hey random q but like how many interns or w/e did esandu end up managing on that powerprox telecom thing lol

**Expected passage.** cm306_esandu_final_report.docx, passage 3
> I am like the team lead, project manager, I have roughly 10 interns under me, that I have to assign the tasks , review once done, integrate to the main

**Expected answer.** Roughly 10 interns.

**Answer** (gemini-3.5-flash, 14.3s)

Esandu managed roughly 10 interns on the Powerprox project [1].

**Cited 1 passage(s):**

- **[1]** `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 3. ROLE(S) AND ACTIVITIES chars 1395–4020 ← expected
  > During my internship at SLT Telecom, I contributed to four significant projects, showcasing my versatility and technical capabilities. 1. PowerProx (Power at Your Fingertips) As my main project, I developed various features for this mobile application designed to manage power assets and employees in the power section: Developed the Solar asset management module, allowing users to add, view, and update solar power system data (July to August - 2 months) Created the Supplier contact information page with filtering capabilities and direct communication options (August - 1 day) Built Employee shifts management for both web and mobile applications using Flutter (August to November - 3 months) Implemented Annual Maintenance Contract (AMC) functionality for adding, renewing, and viewing AMCs

**Auto:** correct passage cited · retrieved at rank 1 · confidence 0.812 (uncalibrated) · grounded True · flagged False

---

## Q16 · unanswerable · `lookup`

**Q.** What is the total budget approved for migrating SLT's servers from the IDC to the new data center?

**Expected.** A refusal: the corpus does not answer this.

**Answer** (gemini-3.5-flash, 18.2s)

The workspace documents do not cover the total budget approved for migrating SLT's servers from the IDC to the new data center.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank — · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

---

## Q17 · unanswerable · `lookup`

**Q.** What overall grade or mark did Esandu receive for the CM4608 Natural Language Processing coursework?

**Expected.** A refusal: the corpus does not answer this.

**Answer** (gemini-3-flash-preview, 24.4s)

The workspace documents do not cover the specific grade or mark received by Esandu for the CM4608 Natural Language Processing coursework.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank — · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---

## Q18 · false_premise · `lookup`

**Q.** Why was the mutation probability in the CM4607 GA raised to 40%?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 55
> Uniform integer mutation was applied with probability Pm = 0.25 (25%) to introduce genetic diversity and prevent premature convergence.

**Expected answer.** The premise is wrong on two counts: the mutation probability was never 40%, and it was never 'raised' - it's a fixed setting. The document states Pm = 0.25 (25%), with a separate per-gene probability indpb = 0.3 (30%) governing which individual genes actually get replaced when mutation is triggered. A correct answer must reject the 40% figure rather than inventing a justification for it.

**Answer** (gemini-3-flash-preview, 11.6s)

The workspace documents do not cover why the mutation probability in the CM4607 GA was raised to 40%, as the provided methodology lists the mutation rate as 25%.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank — · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---

## Q19 · groundedness_trap · `explore`

**Q.** What are all the ways SmartSmile secures patient data, including exactly which encryption algorithm and key-management scheme it uses?

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 22, 24
> FR8.1: The system shall encrypt all patient data at rest and in transit

**Expected answer.** The document only specifies requirements at a high level: patient data is encrypted at rest and in transit (FR8.1), captured images are kept in encrypted local storage (FR2.5), patient identifiers are anonymized before cloud transmission (FR8.2), all data access is audit-logged (FR8.3), role-based access controls are applied (FR8.4), and on the cloud side, AWS IAM roles and AWS Systems Manager Parameter Store manage permissions and secrets. It does NOT name a specific encryption algorithm (e.g. AES-256) or a specific key-management scheme anywhere. A grounded answer must say this detail isn't specified rather than inventing one.

**Answer** (gemini-3-flash-preview, 21.9s)

SmartSmile secures patient data by encrypting it both at rest and in transit [1]. The system anonymizes patient identifiers before they are transmitted to the cloud [1]. Access is managed through role-based controls and IAM roles to configure specific permissions [1][2]. Sensitive variables are stored using the AWS System Manager parameter store [2]. The system also maintains audit logs of all data access and modifications to ensure compliance with healthcare data protection regulations [1]. The provided documents do not specify the exact encryption algorithm or the key-management scheme used by SmartSmile.

**Cited 2 passage(s):**

- **[1]** `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR8: Security and Privacy chars 15313–15731 ← expected
  > ●​ FR8.1: The system shall encrypt all patient data at rest and in transit ●​ FR8.2: The system shall anonymize patient identifiers before cloud transmission ●​ FR8.3: The system shall maintain audit logs of all data access and modifications ●​ FR8.4: The system shall implement appropriate access controls for different user roles ●​ FR8.5: The system shall comply with relevant healthcare data protection regulations

- **[2]** `Group 27 - report - SmartSmile edgeAI.pdf` System Architecture & Design > Architectural Components chars 16121–18266 ← expected
  > 1.​ Mobile Application (Edge Device) a.​ Framework: Built with Flutter for cross-platform compatibility. b.​ Key Functions: i.​ Captures/uploads dental OPG images. ii.​ Runs on-device inference using the YOLOv10 model (using TensorFlow Lite as it is more optimized for mobile). iii.​ Displays annotated results to users in real time. iv.​ Manages user authentication and user’s history. c.​ Advantage: Reduces cloud dependency for inference, lowering latency and bandwidth usage. 2.​ Firebase Cloud Firestore a.​ Purpose: To store user data (user credentials for login) 3.​ Cloud Backend (AWS) a.​ Core Services: i.​ Amazon S3: Stores images in two segregated folders: 1.​ [user_id]/high_confidence/imageId_userid_timestamp.jpg ​ (auto-annotated). 2.​ [user_id]/low_confidence/imageId_userid_time

**Auto:** correct passage cited · retrieved at rank 1 · confidence None (uncalibrated) · grounded True · flagged False

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---

## Q20 · out_of_scope · `lookup`

**Q.** What's the capital of France?

**Expected.** A refusal: the corpus does not answer this.

**Answer** (gemini-3-flash-preview, 13.4s)

The workspace documents do not cover the capital of France.

**No citations.**

**Auto:** expected passage NOT cited · retrieved at rank — · confidence 0 (uncalibrated) · grounded True · flagged True (low_confidence, not_answerable_from_documents)

**Note:** answered by `gemini-3-flash-preview`, a fallback, not the configured answer model.

---
